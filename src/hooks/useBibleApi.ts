// src/hooks/useBibleApi.ts
import { useState } from "react";
import { supabase } from "../lib/supabase";

interface Verse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export function useBibleApi() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChapter = async (book: string, chapter: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("bible_books_and_verses")
        .select("book_name, book_chapter, verse_number, verse_text")
        .eq("book_name", book)
        .eq("book_chapter", chapter)
        .order("verse_number");

      if (supabaseError) {
        throw supabaseError;
      }

      // Transform Supabase data to match your app's Verse interface
      const transformedVerses: Verse[] = (data || []).map((v) => ({
        book: v.book_name,
        chapter: v.book_chapter,
        verse: v.verse_number,
        text: v.verse_text,
      }));

      setVerses(transformedVerses);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch chapter"
      );
      console.error("Error fetching chapter:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchVerses = async (query: string) => {
    if (!query.trim()) {
      setVerses([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("bible_books_and_verses")
        .select("book_name, book_chapter, verse_number, verse_text")
        .ilike("verse_text", `%${query}%`)
        .limit(100)
        .order("book_name")
        .order("book_chapter")
        .order("verse_number");

      if (supabaseError) {
        throw supabaseError;
      }

      // Transform Supabase data to match your app's Verse interface
      const transformedVerses: Verse[] = (data || []).map((v) => ({
        book: v.book_name,
        chapter: v.book_chapter,
        verse: v.verse_number,
        text: v.verse_text,
      }));

      setVerses(transformedVerses);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to search verses"
      );
      console.error("Error searching verses:", err);
    } finally {
      setLoading(false);
    }
  };

  return {
    verses,
    loading,
    error,
    fetchChapter,
    searchVerses,
  };
}
