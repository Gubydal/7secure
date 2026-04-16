-- Supabase Initial Schema for 7secure
-- Run this in your Supabase SQL Editor

-- 1. Create a table for Subscribers (from the Resend/Framer motion form modal)
CREATE TABLE IF NOT EXISTS subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    role TEXT, -- e.g., 'Analyst', 'Engineer', 'CISO', etc. collected from step 1
    interests TEXT[] -- Array of interests like '{News, Tools, Agents}' collected from step 2
);

-- 2. Create a table for Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create a table for Articles / News
CREATE TABLE IF NOT EXISTS articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    summary TEXT,
    content TEXT NOT NULL, -- Keep this text, markdown, or HTML
    author TEXT DEFAULT '7secure',
    author_image TEXT DEFAULT '/Small_Icon.svg',
    cover_image TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    tags TEXT[], -- Additional specific tags
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create a table for Tools / Practices
CREATE TABLE IF NOT EXISTS tools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    url TEXT,     -- Link to the tool if external
    icon TEXT,    -- Name of the lucide icon or SVG url (e.g. 'Shield', 'Fingerprint')
    is_active BOOLEAN DEFAULT true
);

-- Enable Row Level Security (RLS)
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- Allow public read access to categories, articles, and tools
CREATE POLICY "Allow public read access on categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access on articles" ON articles FOR SELECT USING (is_published = true);
CREATE POLICY "Allow public read access on tools" ON tools FOR SELECT USING (is_active = true);

-- Allow public insertion to subscribers only
CREATE POLICY "Allow public insert on subscribers" ON subscribers FOR INSERT WITH CHECK (true);

-- (Optional) If you want users to manage their own subscription you would use authenticated RLS logic here.

-- Insert predefined categories for the UI
INSERT INTO categories (name, slug) VALUES 
('Vulnerabilities', 'vulnerabilities'),
('Threat Intelligence', 'threat-intel'),
('Blue Team', 'blue-team'),
('OSINT', 'osint'),
('Cloud Security', 'cloud-security'),
('Policy & Compliance', 'policy-compliance')
ON CONFLICT (slug) DO NOTHING;