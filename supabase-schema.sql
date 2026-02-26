-- =====================================================
-- KJV Bible App - Supabase Database Schema
-- =====================================================
-- This script recreates the database schema for the KJV Bible App
-- Run this in your Supabase SQL Editor

-- Drop existing tables if they exist (use with caution)
DROP TABLE IF EXISTS bible_books_and_verses CASCADE;
DROP TABLE IF EXISTS bible_books CASCADE;

-- =====================================================
-- Table: bible_books
-- =====================================================
-- Stores metadata about each book of the Bible
CREATE TABLE bible_books (
  book_id SERIAL PRIMARY KEY,
  book_name TEXT NOT NULL UNIQUE,
  testament TEXT NOT NULL CHECK (testament IN ('Old Testament', 'New Testament', 'Apocrypha')),
  seq_number INTEGER NOT NULL,
  chapter_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on testament for faster filtering
CREATE INDEX idx_bible_books_testament ON bible_books(testament);
CREATE INDEX idx_bible_books_seq_number ON bible_books(seq_number);

-- =====================================================
-- Table: bible_books_and_verses
-- =====================================================
-- Stores all Bible verses with full text
CREATE TABLE bible_books_and_verses (
  id BIGSERIAL PRIMARY KEY,
  book_name TEXT NOT NULL,
  book_chapter INTEGER NOT NULL,
  verse_number INTEGER NOT NULL,
  verse_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure each verse is unique
  UNIQUE(book_name, book_chapter, verse_number)
);

-- Create indexes for faster queries
CREATE INDEX idx_verses_book_name ON bible_books_and_verses(book_name);
CREATE INDEX idx_verses_book_chapter ON bible_books_and_verses(book_name, book_chapter);
CREATE INDEX idx_verses_composite ON bible_books_and_verses(book_name, book_chapter, verse_number);

-- =====================================================
-- Full-Text Search Setup
-- =====================================================
-- Add a full-text search index for verse text
-- This enables fast searching across all verses

-- Add a tsvector column for full-text search
ALTER TABLE bible_books_and_verses ADD COLUMN verse_text_tsv TSVECTOR;

-- Create index for full-text search
CREATE INDEX idx_verse_text_fts ON bible_books_and_verses USING GIN(verse_text_tsv);

-- Create function to update tsvector automatically
CREATE OR REPLACE FUNCTION update_verse_text_tsv() RETURNS TRIGGER AS $$
BEGIN
  NEW.verse_text_tsv := to_tsvector('english', NEW.verse_text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to keep tsvector updated
CREATE TRIGGER tsvector_update_trigger
  BEFORE INSERT OR UPDATE ON bible_books_and_verses
  FOR EACH ROW
  EXECUTE FUNCTION update_verse_text_tsv();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
-- Enable RLS on both tables
ALTER TABLE bible_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_books_and_verses ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
-- Anyone can read all Bible data (no authentication required)
CREATE POLICY "Allow public read access to bible_books"
  ON bible_books
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to verses"
  ON bible_books_and_verses
  FOR SELECT
  USING (true);

-- =====================================================
-- Helper Views (Optional but Recommended)
-- =====================================================

-- View to get verse counts per book
CREATE OR REPLACE VIEW book_verse_counts AS
SELECT
  book_name,
  COUNT(*) as total_verses,
  MAX(book_chapter) as chapter_count
FROM bible_books_and_verses
GROUP BY book_name
ORDER BY MIN(book_chapter), book_name;

-- View to get chapter verse counts
CREATE OR REPLACE VIEW chapter_verse_counts AS
SELECT
  book_name,
  book_chapter,
  COUNT(*) as verse_count
FROM bible_books_and_verses
GROUP BY book_name, book_chapter
ORDER BY book_name, book_chapter;

-- Grant public access to views
GRANT SELECT ON book_verse_counts TO anon, authenticated;
GRANT SELECT ON chapter_verse_counts TO anon, authenticated;

-- =====================================================
-- Full-Text Search Function
-- =====================================================
-- Create a function for better full-text search with ranking
CREATE OR REPLACE FUNCTION search_verses(search_query TEXT, max_results INT DEFAULT 100)
RETURNS TABLE (
  book_name TEXT,
  book_chapter INTEGER,
  verse_number INTEGER,
  verse_text TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.book_name,
    v.book_chapter,
    v.verse_number,
    v.verse_text,
    ts_rank(v.verse_text_tsv, websearch_to_tsquery('english', search_query)) as rank
  FROM bible_books_and_verses v
  WHERE v.verse_text_tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC, v.book_name, v.book_chapter, v.verse_number
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the search function
GRANT EXECUTE ON FUNCTION search_verses TO anon, authenticated;

-- =====================================================
-- Sample Query Examples (for testing after data import)
-- =====================================================

-- To search verses using full-text search:
-- SELECT * FROM search_verses('love');
-- SELECT * FROM search_verses('faith hope love', 50);

-- To get all verses for a specific book and chapter:
-- SELECT * FROM bible_books_and_verses
-- WHERE book_name = 'John' AND book_chapter = 3
-- ORDER BY verse_number;

-- To get verse counts by book:
-- SELECT * FROM book_verse_counts;

-- =====================================================
-- End of Schema
-- =====================================================
