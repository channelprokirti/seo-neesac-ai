-- Seed data for directories (sample directories for India and US)

-- Global Directories
INSERT INTO public.directories (name, base_url, country, da_score, submission_type, is_active) VALUES
('Google Business Profile', 'https://business.google.com', 'GLOBAL', 100, 'free', true),
('Facebook Business', 'https://www.facebook.com/business', 'GLOBAL', 96, 'free', true),
('Bing Places', 'https://www.bingplaces.com', 'GLOBAL', 93, 'free', true),
('Apple Maps', 'https://mapsconnect.apple.com', 'GLOBAL', 100, 'free', true),
('LinkedIn Company', 'https://www.linkedin.com/company', 'GLOBAL', 98, 'free', true);

-- US Directories
INSERT INTO public.directories (name, base_url, country, da_score, submission_type, is_active) VALUES
('Yelp', 'https://biz.yelp.com', 'US', 94, 'freemium', true),
('Yellow Pages', 'https://www.yellowpages.com', 'US', 88, 'freemium', true),
('BBB', 'https://www.bbb.org', 'US', 91, 'paid', true),
('Manta', 'https://www.manta.com', 'US', 72, 'freemium', true),
('Foursquare', 'https://foursquare.com', 'US', 92, 'free', true),
('Citysearch', 'https://www.citysearch.com', 'US', 65, 'free', true),
('Superpages', 'https://www.superpages.com', 'US', 68, 'free', true),
('Hotfrog', 'https://www.hotfrog.com', 'US', 58, 'free', true),
('MapQuest', 'https://www.mapquest.com', 'US', 88, 'free', true),
('TripAdvisor', 'https://www.tripadvisor.com', 'US', 93, 'free', true),
('Angi (Angie''s List)', 'https://www.angi.com', 'US', 87, 'paid', true),
('HomeAdvisor', 'https://www.homeadvisor.com', 'US', 85, 'paid', true),
('Thumbtack', 'https://www.thumbtack.com', 'US', 86, 'paid', true),
('Nextdoor', 'https://business.nextdoor.com', 'US', 91, 'freemium', true);

-- India National Directories
INSERT INTO public.directories (name, base_url, country, da_score, submission_type, is_active) VALUES
('JustDial', 'https://www.justdial.com', 'IN', 85, 'freemium', true),
('Sulekha', 'https://www.sulekha.com', 'IN', 78, 'freemium', true),
('IndiaMART', 'https://www.indiamart.com', 'IN', 82, 'freemium', true),
('TradeIndia', 'https://www.tradeindia.com', 'IN', 75, 'freemium', true),
('Exporters India', 'https://www.exportersindia.com', 'IN', 68, 'freemium', true),
('India Yellow Pages', 'https://www.yellowpages.co.in', 'IN', 55, 'free', true),
('AskLaila', 'https://www.asklaila.com', 'IN', 52, 'free', true),
('GetIt', 'https://www.getit.in', 'IN', 48, 'free', true),
('UrbanPro', 'https://www.urbanpro.com', 'IN', 65, 'freemium', true),
('Practo', 'https://www.practo.com', 'IN', 78, 'freemium', true),
('1mg', 'https://www.1mg.com', 'IN', 75, 'freemium', true),
('BookMyShow', 'https://in.bookmyshow.com', 'IN', 85, 'free', true),
('Zomato', 'https://www.zomato.com', 'IN', 88, 'freemium', true),
('Swiggy', 'https://www.swiggy.com', 'IN', 82, 'free', true);

-- UK Directories
INSERT INTO public.directories (name, base_url, country, da_score, submission_type, is_active) VALUES
('Yell', 'https://www.yell.com', 'UK', 85, 'freemium', true),
('Thomson Local', 'https://www.thomsonlocal.com', 'UK', 68, 'free', true),
('Scoot', 'https://www.scoot.co.uk', 'UK', 55, 'free', true),
('FreeIndex', 'https://www.freeindex.co.uk', 'UK', 62, 'free', true),
('Cylex UK', 'https://www.cylex-uk.co.uk', 'UK', 52, 'free', true),
('Yelp UK', 'https://www.yelp.co.uk', 'UK', 94, 'freemium', true),
('Trustpilot', 'https://www.trustpilot.com', 'UK', 93, 'freemium', true);

-- Add region mappings for US directories
INSERT INTO public.directory_regions (directory_id, country, state, city)
SELECT id, 'US', NULL, NULL FROM public.directories WHERE country = 'US';

-- Add region mappings for India directories
INSERT INTO public.directory_regions (directory_id, country, state, city)
SELECT id, 'IN', NULL, NULL FROM public.directories WHERE country = 'IN';

-- Add region mappings for UK directories
INSERT INTO public.directory_regions (directory_id, country, state, city)
SELECT id, 'UK', NULL, NULL FROM public.directories WHERE country = 'UK';

-- Add region mappings for Global directories
INSERT INTO public.directory_regions (directory_id, country, state, city)
SELECT id, 'GLOBAL', NULL, NULL FROM public.directories WHERE country = 'GLOBAL';

-- Industry categories for specific directories
INSERT INTO public.directory_industries (directory_id, industry_category)
SELECT d.id, i.category
FROM public.directories d
CROSS JOIN (
    VALUES ('restaurants'), ('retail'), ('healthcare'), ('professional_services'), 
           ('home_services'), ('automotive'), ('beauty_wellness'), ('education'),
           ('real_estate'), ('legal'), ('finance'), ('technology')
) AS i(category)
WHERE d.name IN ('Google Business Profile', 'Facebook Business', 'Yelp', 'JustDial', 'Sulekha', 'Yell');

-- Restaurant-specific directories
INSERT INTO public.directory_industries (directory_id, industry_category)
SELECT d.id, 'restaurants'
FROM public.directories d
WHERE d.name IN ('Zomato', 'Swiggy', 'TripAdvisor', 'BookMyShow');

-- Healthcare-specific directories
INSERT INTO public.directory_industries (directory_id, industry_category)
SELECT d.id, 'healthcare'
FROM public.directories d
WHERE d.name IN ('Practo', '1mg');

-- B2B directories
INSERT INTO public.directory_industries (directory_id, industry_category)
SELECT d.id, i.category
FROM public.directories d
CROSS JOIN (VALUES ('manufacturing'), ('wholesale'), ('b2b_services')) AS i(category)
WHERE d.name IN ('IndiaMART', 'TradeIndia', 'Exporters India');

-- Home services directories
INSERT INTO public.directory_industries (directory_id, industry_category)
SELECT d.id, 'home_services'
FROM public.directories d
WHERE d.name IN ('Angi (Angie''s List)', 'HomeAdvisor', 'Thumbtack', 'UrbanPro');


