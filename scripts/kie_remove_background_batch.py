import json
import os
import sys
import time

import requests


UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload"
CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask"
TASK_STATUS_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"


def load_api_key():
    api_key = os.environ.get("KIE_API_KEY")
    if api_key:
        return api_key

    candidate_paths = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
    ]

    for env_path in candidate_paths:
        if not os.path.exists(env_path):
            continue
        with open(env_path, "r", encoding="utf-8") as file_obj:
            for line in file_obj:
                if line.startswith("KIE_API_KEY="):
                    return line.strip().split("=", 1)[1].strip("\"'")
    return None


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def extract_result_urls(task_data):
    result_json_str = task_data.get("resultJson", "{}")
    if isinstance(result_json_str, dict):
        result_json = result_json_str
    else:
        try:
            result_json = json.loads(result_json_str)
        except json.JSONDecodeError:
            result_json = {}
    return result_json.get("resultUrls", [])


def upload_file(api_key, file_path):
    headers = {"Authorization": f"Bearer {api_key}"}
    with open(file_path, "rb") as file_obj:
        response = requests.post(
            UPLOAD_URL,
            headers=headers,
            files={"file": (os.path.basename(file_path), file_obj)},
            data={"uploadPath": "images/watch-strap-visualizer"},
            timeout=120,
        )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", {})
    file_url = data.get("downloadUrl") or data.get("url") or data.get("fileUrl")
    if not file_url:
        raise RuntimeError(f"Upload succeeded but no file URL was returned: {payload}")
    return file_url


def create_remove_bg_task(api_key, image_url):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": "recraft/remove-background",
        "input": {"image": image_url},
    }
    response = requests.post(CREATE_TASK_URL, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    task_id = response.json().get("data", {}).get("taskId")
    if not task_id:
        raise RuntimeError(f"No taskId returned from createTask: {response.text}")
    return task_id


def poll_task(api_key, task_id):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    for attempt in range(1, 91):
        time.sleep(3)
        response = requests.get(
            TASK_STATUS_URL,
            headers=headers,
            params={"taskId": task_id},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json().get("data", {})
        state = data.get("state")
        print(f"poll {attempt}: state={state}")
        if state in {"success", "completed"}:
            result_urls = extract_result_urls(data)
            if not result_urls:
                raise RuntimeError(f"Task completed but no result URL returned: {data}")
            return result_urls[0]
        if state in {"failed", "error"}:
            raise RuntimeError(f"Task failed: {json.dumps(data, indent=2)}")
    raise RuntimeError("Task timed out")


def download_file(url, output_path):
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    with open(output_path, "wb") as file_obj:
        file_obj.write(response.content)


def process_file(api_key, input_path, output_path):
    print(f"uploading {input_path}")
    uploaded_url = upload_file(api_key, input_path)
    print(f"uploaded url: {uploaded_url}")
    task_id = create_remove_bg_task(api_key, uploaded_url)
    print(f"task id: {task_id}")
    result_url = poll_task(api_key, task_id)
    print(f"downloading {result_url}")
    download_file(result_url, output_path)
    print(f"saved {output_path}")


def list_images(input_dir):
    entries = []
    for name in sorted(os.listdir(input_dir)):
        if name.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            entries.append(name)
    return entries


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: python3 scripts/kie_remove_background_batch.py "
            "<input_dir> <output_dir> [single_filename]"
        )
        sys.exit(1)

    input_dir = sys.argv[1]
    output_dir = sys.argv[2]
    single_filename = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.isdir(input_dir):
        print(f"ERROR: Input directory not found: {input_dir}")
        sys.exit(1)

    api_key = load_api_key()
    if not api_key:
        print("ERROR: KIE_API_KEY not found in environment or .env")
        sys.exit(1)

    ensure_dir(output_dir)
    names = [single_filename] if single_filename else list_images(input_dir)

    for name in names:
        input_path = os.path.join(input_dir, name)
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
        output_name = os.path.splitext(name)[0] + ".png"
        output_path = os.path.join(output_dir, output_name)
        process_file(api_key, input_path, output_path)


if __name__ == "__main__":
    main()
