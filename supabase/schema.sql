CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT FALSE,
  is_incident BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}'
);

CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  resend_contact_id TEXT,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE TABLE digest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  article_count INT NOT NULL,
  subscriber_count INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success'
);

CREATE TABLE digest_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  context TEXT NOT NULL DEFAULT 'daily_digest_email',
  feedback_source TEXT NOT NULL DEFAULT 'email_star_click',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE digest_sent_articles (
  article_slug TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  newsletter_title TEXT,
  snippets JSONB DEFAULT '[]',
  article_slugs TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_digest_feedback_email ON digest_feedback(email);
CREATE INDEX idx_digest_feedback_source ON digest_feedback(feedback_source);
CREATE INDEX idx_digest_sent_articles_sent_at ON digest_sent_articles(sent_at DESC);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_sent_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_daily_briefings_date ON daily_briefings(briefing_date DESC);

CREATE POLICY "Public read articles" ON articles FOR SELECT USING (true);
CREATE POLICY "Public read daily_briefings" ON daily_briefings FOR SELECT USING (true);
CREATE POLICY "Service role full access articles" ON articles USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access subscribers" ON subscribers USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access digest_logs" ON digest_logs USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access digest_feedback" ON digest_feedback USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access digest_sent_articles" ON digest_sent_articles USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access daily_briefings" ON daily_briefings USING (auth.role() = 'service_role');
