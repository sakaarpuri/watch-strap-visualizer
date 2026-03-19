"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { FavoriteStrap, ProfileRecord, SavedStrap, SavedWatch } from "@/lib/collection";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { StrapCategory } from "@/lib/strapLibrary";

const watchBucket = "user-watches";
const strapBucket = "user-straps";

const ensurePasswordStrength = (password: string) => {
  if (password.length < 6) return "Use at least 6 characters.";
  if (!/[0-9\W_]/.test(password)) return "Add at least one number or symbol.";
  return null;
};

const uploadUserFile = async (bucket: string, userId: string, file: File, prefix: string) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const extension = file.name.split(".").pop() || (file.type.includes("png") ? "png" : "jpg");
  const path = `${userId}/${prefix}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
};

const removePublicStorageObject = async (bucket: string, publicUrl: string) => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !publicUrl) return;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  await supabase.storage.from(bucket).remove([path]);
};

export function usePersonalCollection() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [savedWatches, setSavedWatches] = useState<SavedWatch[]>([]);
  const [savedStraps, setSavedStraps] = useState<SavedStrap[]>([]);
  const [favorites, setFavorites] = useState<FavoriteStrap[]>([]);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const configured = hasSupabaseConfig;

  const loadCollection = useCallback(async (nextUser: User) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const [{ data: profileData }, { data: watchesData }, { data: strapsData }, { data: favoritesData }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", nextUser.id).maybeSingle(),
        supabase.from("saved_watches").select("*").eq("user_id", nextUser.id).order("created_at", { ascending: false }),
        supabase.from("saved_straps").select("*").eq("user_id", nextUser.id).order("created_at", { ascending: false }),
        supabase.from("favorite_straps").select("*").eq("user_id", nextUser.id).order("created_at", { ascending: false })
      ]);

    const metaName = typeof nextUser.user_metadata?.full_name === "string" ? nextUser.user_metadata.full_name : "";
    if (!profileData && metaName) {
      await supabase.from("profiles").upsert({ id: nextUser.id, full_name: metaName });
      setProfile({ id: nextUser.id, full_name: metaName });
    } else {
      setProfile((profileData as ProfileRecord | null) ?? null);
    }
    setSavedWatches((watchesData as SavedWatch[] | null) ?? []);
    setSavedStraps((strapsData as SavedStrap[] | null) ?? []);
    setFavorites((favoritesData as FavoriteStrap[] | null) ?? []);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadCollection(data.session.user);
      }
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void loadCollection(nextSession.user);
      } else {
        setProfile(null);
        setSavedWatches([]);
        setSavedStraps([]);
        setFavorites([]);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadCollection]);

  const refresh = useCallback(async () => {
    if (!user) return;
    await loadCollection(user);
  }, [loadCollection, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signUp = useCallback(async (fullName: string, email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const passwordError = ensurePasswordStrength(password);
    if (passwordError) throw new Error(passwordError);
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/` : undefined;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: fullName }
        }
      });
      if (error) throw error;
      if (!data.session) {
        setAuthMessage(`Check ${email} to confirm your account, then come back here.`);
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const updateDisplayName = useCallback(async (fullName: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("You need to be signed in.");
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, full_name: fullName });
      if (profileError) throw profileError;
      await refresh();
    } finally {
      setAuthBusy(false);
    }
  }, [refresh, user]);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("You need to be signed in.");
    const passwordError = ensurePasswordStrength(password);
    if (passwordError) throw new Error(passwordError);
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } finally {
      setAuthBusy(false);
    }
  }, [user]);

  const saveWatch = useCallback(async ({ label, file, watchBrand, notes }: { label: string; file: File; watchBrand?: string; notes?: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to save watches.");
    const uploaded = await uploadUserFile(watchBucket, user.id, file, "watch");
    const { error } = await supabase.from("saved_watches").insert({
      user_id: user.id,
      label,
      image_url: uploaded.publicUrl,
      watch_brand: watchBrand || null,
      notes: notes || null
    });
    if (error) throw error;
    await refresh();
  }, [refresh, user]);

  const saveStrap = useCallback(async ({ label, category, partAFile, partBFile, material, hardwareFinish }: { label: string; category: StrapCategory; partAFile: File; partBFile: File; material?: string; hardwareFinish?: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to save straps.");
    const [uploadedA, uploadedB] = await Promise.all([
      uploadUserFile(strapBucket, user.id, partAFile, "strap-a"),
      uploadUserFile(strapBucket, user.id, partBFile, "strap-b")
    ]);
    const { error } = await supabase.from("saved_straps").insert({
      user_id: user.id,
      label,
      category,
      strap_a_url: uploadedA.publicUrl,
      strap_b_url: uploadedB.publicUrl,
      material: material || null,
      hardware_finish: hardwareFinish || null
    });
    if (error) throw error;
    await refresh();
  }, [refresh, user]);

  const renameWatch = useCallback(async (id: string, label: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to rename watches.");
    const { error } = await supabase.from("saved_watches").update({ label }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    await refresh();
  }, [refresh, user]);

  const deleteWatch = useCallback(async (watch: SavedWatch) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to delete watches.");
    await removePublicStorageObject(watchBucket, watch.image_url);
    const { error } = await supabase.from("saved_watches").delete().eq("id", watch.id).eq("user_id", user.id);
    if (error) throw error;
    await refresh();
  }, [refresh, user]);

  const renameStrap = useCallback(async (id: string, label: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to rename straps.");
    const { error } = await supabase.from("saved_straps").update({ label }).eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    await refresh();
  }, [refresh, user]);

  const deleteStrap = useCallback(async (strap: SavedStrap) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to delete straps.");
    await Promise.all([
      removePublicStorageObject(strapBucket, strap.strap_a_url),
      removePublicStorageObject(strapBucket, strap.strap_b_url)
    ]);
    const { error } = await supabase.from("saved_straps").delete().eq("id", strap.id).eq("user_id", user.id);
    if (error) throw error;
    await refresh();
  }, [refresh, user]);

  const toggleFavorite = useCallback(async (input: { sourceType: "library"; libraryStrapId: string } | { sourceType: "saved"; savedStrapId: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) throw new Error("Sign in to save favorites.");
    const existing = favorites.find((favorite) =>
      input.sourceType === "library"
        ? favorite.source_type === "library" && favorite.library_strap_id === input.libraryStrapId
        : favorite.source_type === "saved" && favorite.saved_strap_id === input.savedStrapId
    );

    if (existing) {
      const { error } = await supabase.from("favorite_straps").delete().eq("id", existing.id).eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("favorite_straps").insert({
        user_id: user.id,
        source_type: input.sourceType,
        library_strap_id: input.sourceType === "library" ? input.libraryStrapId : null,
        saved_strap_id: input.sourceType === "saved" ? input.savedStrapId : null
      });
      if (error) throw error;
    }
    await refresh();
  }, [favorites, refresh, user]);

  const favoriteLookup = useMemo(() => new Set(
    favorites.map((favorite) => favorite.source_type === "library"
      ? `library:${favorite.library_strap_id}`
      : `saved:${favorite.saved_strap_id}`)
  ), [favorites]);

  return {
    configured,
    loading,
    authBusy,
    authMessage,
    user,
    session,
    profile,
    savedWatches,
    savedStraps,
    favorites,
    favoriteLookup,
    signIn,
    signUp,
    signOut,
    updateDisplayName,
    updatePassword,
    saveWatch,
    saveStrap,
    renameWatch,
    deleteWatch,
    renameStrap,
    deleteStrap,
    toggleFavorite,
    refresh
  };
}
