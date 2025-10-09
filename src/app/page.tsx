"use client";

import { useState, useEffect } from "react";
import { BibleHeader } from "@/components/BibleHeader";
import { VerseDisplay } from "@/components/VerseDisplay";
import { Favorites } from "@/components/Favorites";
import { Topics } from "@/components/Topics";
import { BooksExplorer } from "@/components/BooksExplorer";
import { useBibleApi } from "@/hooks/useBibleApi";
import { supabase } from "@/lib/supabase";

interface Verse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  verses: Verse[];
  createdAt: Date;
}

export default function HomePage() {
  const [selectedBook, setSelectedBook] = useState("Genesis");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState(false);
  const [activeTab, setActiveTab] = useState("read");

  // Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteVerses, setFavoriteVerses] = useState<Verse[]>([]);

  // Topics state
  const [topics, setTopics] = useState<Topic[]>([]);

  const { verses, loading, error, fetchChapter, searchVerses } =
    useBibleApi();

  // Load initial chapter on component mount
  useEffect(() => {
    fetchChapter(selectedBook, selectedChapter);
  }, []);

  // Update favorite verses array when favorites set changes
  useEffect(() => {
    const favoritesArray: Verse[] = [];
    favorites.forEach((favoriteKey) => {
      const verse = findVerseByKey(favoriteKey);
      if (verse) {
        favoritesArray.push(verse);
      }
    });
    setFavoriteVerses(favoritesArray);
  }, [favorites]);

  const findVerseByKey = (key: string): Verse | null => {
    // Try to find the verse in current verses first
    const foundVerse = verses.find(
      (v) => `${v.book}_${v.chapter}_${v.verse}` === key
    );
    if (foundVerse) return foundVerse;

    // If not found, try to find in favoriteVerses (for existing favorites)
    const existingFavorite = favoriteVerses.find(
      (v) => `${v.book}_${v.chapter}_${v.verse}` === key
    );
    if (existingFavorite) return existingFavorite;

    return null;
  };

  const handleBookChange = (book: string) => {
    setSelectedBook(book);
    setSelectedChapter(1);
    setSearchMode(false);
    fetchChapter(book, 1);
  };

  const handleChapterChange = (chapter: number) => {
    setSelectedChapter(chapter);
    setSearchMode(false);
    fetchChapter(selectedBook, chapter);
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      setSearchMode(true);
      searchVerses(query);
    } else {
      setSearchMode(false);
      fetchChapter(selectedBook, selectedChapter);
    }
  };

  // Handle book selection from Books Explorer
  const handleBooksExplorerSelection = (
    book: string,
    chapter?: number
  ) => {
    setSelectedBook(book);
    if (chapter) {
      setSelectedChapter(chapter);
      fetchChapter(book, chapter);
    } else {
      setSelectedChapter(1);
      fetchChapter(book, 1);
    }
    setSearchMode(false);
  };

  const handleToggleFavorite = (verse: Verse) => {
    const key = `${verse.book}_${verse.chapter}_${verse.verse}`;
    const newFavorites = new Set(favorites);
    const newFavoriteVerses = [...favoriteVerses];

    if (newFavorites.has(key)) {
      newFavorites.delete(key);
      const index = newFavoriteVerses.findIndex(
        (v) => `${v.book}_${v.chapter}_${v.verse}` === key
      );
      if (index > -1) {
        newFavoriteVerses.splice(index, 1);
      }
    } else {
      newFavorites.add(key);
      newFavoriteVerses.push(verse);
    }

    setFavorites(newFavorites);
    setFavoriteVerses(newFavoriteVerses);
  };

  const handleRemoveFavorite = (verse: Verse) => {
    handleToggleFavorite(verse);
  };

  const handleCreateTopic = (
    topicData: Omit<Topic, "id" | "createdAt">
  ) => {
    const newTopic: Topic = {
      ...topicData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setTopics([...topics, newTopic]);
  };

  const handleDeleteTopic = (topicId: string) => {
    setTopics(topics.filter((topic) => topic.id !== topicId));
  };

  const handleAddVerseToTopic = (topicId: string, verse: Verse) => {
    setTopics(
      topics.map((topic) => {
        if (topic.id === topicId) {
          // Check if verse is already in this topic
          const verseExists = topic.verses.some(
            (v) =>
              v.book === verse.book &&
              v.chapter === verse.chapter &&
              v.verse === verse.verse
          );
          if (!verseExists) {
            return { ...topic, verses: [...topic.verses, verse] };
          }
        }
        return topic;
      })
    );
  };

  const handleRemoveVerseFromTopic = (
    topicId: string,
    verse: Verse
  ) => {
    setTopics(
      topics.map((topic) => {
        if (topic.id === topicId) {
          return {
            ...topic,
            verses: topic.verses.filter(
              (v) =>
                !(
                  v.book === verse.book &&
                  v.chapter === verse.chapter &&
                  v.verse === verse.verse
                )
            ),
          };
        }
        return topic;
      })
    );
  };

  // Search function for Topics component
  // In your page.tsx, replace the handleTopicsSearch function with:
  const handleTopicsSearch = async (
    query: string
  ): Promise<Verse[]> => {
    try {
      const { data, error } = await supabase
        .from("bible_books_and_verses")
        .select("book_name, book_chapter, verse_number, verse_text")
        .ilike("verse_text", `%${query}%`)
        .limit(50);

      if (error) throw error;

      // Transform to match your Verse interface
      return (data || []).map((v) => ({
        book: v.book_name,
        chapter: v.book_chapter,
        verse: v.verse_number,
        text: v.verse_text,
      }));
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  };

  // Function to fetch chapter context for verse expansion
  // In your page.tsx, replace the handleFetchChapter function with:
  const handleFetchChapter = async (
    book: string,
    chapter: number
  ): Promise<Verse[]> => {
    try {
      const { data, error } = await supabase
        .from("bible_books_and_verses")
        .select("book_name, book_chapter, verse_number, verse_text")
        .eq("book_name", book)
        .eq("book_chapter", chapter)
        .order("verse_number");

      if (error) throw error;

      // Transform to match your Verse interface
      return (data || []).map((v) => ({
        book: v.book_name,
        chapter: v.book_chapter,
        verse: v.verse_number,
        text: v.verse_text,
      }));
    } catch (error) {
      console.error("Fetch chapter error:", error);
      return [];
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "books":
        return (
          <BooksExplorer
            onBookSelect={handleBooksExplorerSelection}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            verses={verses}
            loading={loading}
          />
        );
      case "favorites":
        return (
          <Favorites
            favoriteVerses={favoriteVerses}
            onRemoveFavorite={handleRemoveFavorite}
          />
        );
      case "topics":
        return (
          <Topics
            topics={topics}
            favoriteVerses={favoriteVerses}
            onCreateTopic={handleCreateTopic}
            onDeleteTopic={handleDeleteTopic}
            onAddVerseToTopic={handleAddVerseToTopic}
            onRemoveVerseFromTopic={handleRemoveVerseFromTopic}
            onSearchVerses={handleTopicsSearch}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        );
      default:
        return (
          <VerseDisplay
            verses={verses}
            loading={loading}
            searchMode={searchMode}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onFetchChapter={handleFetchChapter}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <BibleHeader
        onSearch={handleSearch}
        onBookChange={handleBookChange}
        onChapterChange={handleChapterChange}
        selectedBook={selectedBook}
        selectedChapter={selectedChapter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {error && (
        <div className="container mx-auto px-4 py-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
            Error: {error}
          </div>
        </div>
      )}

      {renderActiveTab()}
    </div>
  );
}
