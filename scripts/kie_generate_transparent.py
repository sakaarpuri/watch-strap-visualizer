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
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
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


def load_prompt(prompt_file):
    with open(prompt_file, "r", encoding="utf-8") as file_obj:
        return json.load(file_obj)


def ensure_output_dir(output_file):
    output_dir = os.path.dirname(os.path.abspath(output_file))
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)


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


def poll_task(headers, task_id, label):
    attempts = 0
    while attempts < 90:
      time.sleep(4)
      attempts += 1
      response = requests.get(
          TASK_STATUS_URL,
          headers=headers,
          params={"taskId": task_id},
          timeout=20,
      )
      response.raise_for_status()
      payload = response.json()
      data = payload.get("data", {})
      state = data.get("state")
      print(f"{label} poll {attempts}: state = {state}")

      if state in {"success", "completed"}:
          result_urls = extract_result_urls(data)
          if not result_urls:
              raise RuntimeError(f"{label} completed without result URL")
          return result_urls[0]

      if state in {"failed", "error"}:
          raise RuntimeError(json.dumps(data, indent=2))

    raise RuntimeError(f"{label} timed out waiting for completion")


def create_task(headers, model, input_payload):
    response = requests.post(
        CREATE_TASK_URL,
        headers=headers,
        json={"model": model, "input": input_payload},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    task_id = payload.get("data", {}).get("taskId")
    if not task_id:
        raise RuntimeError(f"No taskId returned: {payload}")
    return task_id


def upload_file(api_key, file_path, upload_path="images/watch-strap-visualizer"):
    headers = {"Authorization": f"Bearer {api_key}"}
    with open(file_path, "rb") as file_obj:
        response = requests.post(
            UPLOAD_URL,
            headers=headers,
            files={"file": (os.path.basename(file_path), file_obj)},
            data={"uploadPath": upload_path},
            timeout=120,
        )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", {})
    file_url = data.get("downloadUrl") or data.get("url") or data.get("fileUrl")
    if not file_url:
        raise RuntimeError(f"Upload succeeded but no file URL was returned: {payload}")
    return file_url


def build_generation_input(prompt_json, aspect_ratio, api_key):
    prompt_copy = dict(prompt_json)
    image_input = prompt_copy.pop("image_input", None)
    reference_files = prompt_copy.pop("reference_files", None)
    api_parameters = prompt_copy.pop("api_parameters", {})

    payload = {
        "prompt": json.dumps(prompt_copy, ensure_ascii=False),
        "aspect_ratio": api_parameters.get("aspect_ratio", aspect_ratio),
        "resolution": api_parameters.get("resolution", "2K"),
        "output_format": api_parameters.get("output_format", "png"),
    }
    if "google_search" in api_parameters:
        payload["google_search"] = api_parameters["google_search"]
    if image_input:
        payload["image_input"] = image_input
    if reference_files:
        uploaded = [upload_file(api_key, path) for path in reference_files]
        payload["image_input"] = (payload.get("image_input") or []) + uploaded
    return payload


def download_image(url, output_file):
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    with open(output_file, "wb") as file_obj:
        file_obj.write(response.content)


def run():
    if len(sys.argv) < 3:
        print(
            "Usage: python3 scripts/kie_generate_transparent.py "
            "<prompt_json_file> <output_file> [aspect_ratio]"
        )
        sys.exit(1)

    prompt_file = sys.argv[1]
    output_file = sys.argv[2]
    aspect_ratio = sys.argv[3] if len(sys.argv) > 3 else "1:1"

    if not os.path.exists(prompt_file):
        print(f"ERROR: Prompt file not found: {prompt_file}")
        sys.exit(1)

    api_key = load_api_key()
    if not api_key:
        print("ERROR: KIE_API_KEY not found in environment or .env")
        sys.exit(1)

    try:
        prompt_json = load_prompt(prompt_file)
    except json.JSONDecodeError as exc:
        print(f"ERROR: Prompt file is not valid JSON: {exc}")
        sys.exit(1)

    ensure_output_dir(output_file)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        generation_input = build_generation_input(prompt_json, aspect_ratio, api_key)
        print("Creating nano-banana-2 task...")
        generation_task_id = create_task(headers, "nano-banana-2", generation_input)
        print(f"Generation task ID: {generation_task_id}")
        generated_url = poll_task(headers, generation_task_id, "generation")
        print(f"Generated URL: {generated_url}")

        print("Creating recraft/remove-background task...")
        remove_bg_task_id = create_task(
            headers,
            "recraft/remove-background",
            {"image": generated_url},
        )
        print(f"Remove-background task ID: {remove_bg_task_id}")
        cleaned_url = poll_task(headers, remove_bg_task_id, "remove-bg")
        print(f"Cleaned URL: {cleaned_url}")

        print(f"Downloading cleaned image to {output_file}")
        download_image(cleaned_url, output_file)
        print(f"Successfully saved to {output_file}")
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    run()
