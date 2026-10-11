# Shortn

## Local development

Install dependencies with `bun install`, keep your credentials in the root `.env.staging`, and start Docker. Then run:

```sh
bun run dev
```

This starts the new web app at http://localhost:3000, redirects on port 3002, API on 3003, and worker on 3004. It loads `.env.staging` explicitly, maps the legacy `MONGODB_KEY` to the new database settings, and uses localhost for app/auth origins. Optional OAuth providers require valid credential pairs; unavailable providers are reported at startup.

Missing Redis URLs use dedicated Docker services on ports 16380 (cache) and 16379 (durable). Missing MongoDB settings use a local replica set on port 27020. When all S3 settings are absent, the launcher starts local RustFS storage on port 19000 and creates the development bucket. Explicit remote connections, including the S3 settings in `.env.staging`, are preserved. Missing link and confirmation signing keys are derived for local development from `BETTER_AUTH_SECRET`. The launcher does not modify `.env.staging` or run database migrations.

QR logos, account avatars and bio images upload directly from files. The server validates images (up to 5 MB), converts them to PNG and stores them in S3. Replacing or removing an image changes the saved reference; existing objects are retained.

Use `bun run dev:check` to validate configuration without starting services. Override app ports with `DEV_WEB_PORT`, `DEV_REDIRECT_PORT`, `DEV_API_PORT`, and `DEV_WORKER_PORT`. Ctrl+C stops the app processes; Docker volumes persist. To stop the dev containers, run `docker compose -f docker-compose.dev.yml down`.

**A modern URL shortener and link-in-bio platform built for businesses, creators, and brands.**

Shortn is a comprehensive link management solution that goes beyond simple URL shortening. It provides powerful analytics, customizable QR codes, and beautiful link-in-bio pages—all in one platform. Currently serving [Vida Económica](https://vidaeconomica.pt), Portugal's leading economic magazine, Shortn has been trusted to deliver over 2.4 million clicks with enterprise-grade reliability.

---

## Dashboard browser checks

Build the web app and start the local dependencies, then run the authenticated browser suite:

```sh
bun run --cwd apps/web build
docker compose -f docker-compose.dev.yml up -d --wait mongo redis-cache redis-durable storage
docker compose -f docker-compose.dev.yml run --rm mongo-init
bun run --cwd apps/web test:dashboard
```

Install Chromium with `bunx playwright-core install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable. The suite starts its own production server on port 3200, seeds a temporary local database, signs in through the UI, checks dashboard routes in en/pt/es, and verifies creation, saves, copy/share, password changes, session revocation and membership changes against MongoDB. QR checks also save colours, patterns and error correction, exercise logo failures, and decode PNG/SVG/JPEG exports to verify their dimensions and short-link payloads. It deletes its database and stops its server afterward. It uses generated test credentials and does not load `.env.staging`.

The suite also checks the handoff exchange with legacy-shaped tokens (expiry, replay and redirect protection), adding a password to an OAuth-only account, and impersonation banner, fixed one-hour expiry and sign-out. OAuth provider callbacks and the actual legacy-host round-trip still require staging verification.

Email checks capture Resend payloads on a local HTTP receiver, follow generated approval/verification links, check expired/used links and session revocation, and sign in with the updated address. The suite sends no mail to external recipients. Each run uses a distinct test client IP to isolate authentication rate limits.

Billing checks route provider requests to a local receiver and verify payment history, refunds/currency, retry recovery, invoice redirects/errors, workspace isolation, checkout/portal feedback and owner permissions. Run `bun run --cwd apps/web test:billing` to also exercise plan-change, cancellation and resume failures with billing writes enabled. The default suite verifies the legacy billing gate remains in place. Neither command contacts Polar or creates charges; live provider flows still need staging verification. Pass `--billing-only` for the focused billing checks, or `--mutations-only` to skip the locale route sweep while retaining browser mutations and cross-service checks.

Uploads are tested against local S3-compatible storage on port 19000 using a temporary bucket. The suite checks actual image uploads, invalid files, access restrictions, saved references and QR exports with embedded logos, then deletes its bucket and objects. Analytics checks verify filtered totals and CSV campaign/link scope.

Optional settings: `DASHBOARD_PORT`, `DASHBOARD_MONGO_URL`, `DASHBOARD_REDIS_CACHE_URL`, `DASHBOARD_REDIS_DURABLE_URL`, and `DASHBOARD_SCREENSHOT_DIR`. Database connections must use localhost. Defaults match `docker-compose.dev.yml`; Redis uses database 15.

To include public password-link and safety/report flows against the real redirect service, run `bun run --cwd apps/web test:flows`. It uses the same isolated local database and generated shared secrets, with a redirect server on port 3202 (`DASHBOARD_REDIRECT_PORT` overrides it).

## 🎯 What is Shortn?

Shortn helps you create, manage, and track every link you share. Whether you're running marketing campaigns, managing social media, or building your personal brand, Shortn gives you the tools to:

- **Shorten URLs** with custom, branded links
- **Track engagement** with real-time analytics and insights
- **Generate QR codes** with full customization options
- **Build link-in-bio pages** that showcase all your important links in one place
- **Organize campaigns** and measure performance across channels

Built with scale and performance in mind, Shortn handles millions of clicks while providing detailed analytics on every interaction.

---

## ✨ Core Features

### 🔗 Smart Link Shortening

- Custom short URLs with your own domain
- Bulk link creation and management
- Link expiration and scheduling options
- UTM parameter support for campaign tracking
- Password-protected links

### 📊 Advanced Analytics

- Real-time click tracking and reporting
- Geographic location data with interactive maps
- Device and browser breakdown
- Referrer source tracking
- Time-series data visualization
- CSV export for deeper analysis

### 📱 QR Code Generation

- Fully customizable QR codes (colors, logos, styles)
- Dynamic QR codes that update without reprinting
- Scan analytics and tracking
- High-resolution downloads for print and digital

### 🎨 Link-in-Bio Pages

- Beautiful, customizable landing pages for all your links
- Drag-and-drop link reordering
- Custom themes and branding options
- Profile images and descriptions
- Social media integration
- Mobile-optimized design

### 🏢 Enterprise Features

- Campaign management and grouping
- Team collaboration tools
- Tag-based organization
- API access for integrations
- White-label options
- Priority support

---

## 🚀 How It Works

Shortn streamlines link management in three simple steps:

1. **Create** - Paste any URL and get a short, branded link instantly
2. **Customize** - Add QR codes, create bio pages, and organize links into campaigns
3. **Track** - Monitor clicks, analyze traffic sources, and optimize your strategy

### Technical Foundation

Built on a modern, scalable tech stack:

- **Next.js** for a fast, SEO-friendly frontend
- **MongoDB** for flexible, high-performance data storage
- **Polar** integration for seamless subscription management
- **Advanced caching** for sub-50ms response times
- **Real-time analytics** processing millions of events

The platform is designed to handle enterprise-scale traffic while maintaining a seamless user experience.

---

## 📸 Live Demo & Screenshots

> **Live Platform:** [shortn.at](https://shortn.at)

_Screenshots and demo videos coming soon_

---

## 💡 Example Use Cases

### For Content Creators

Create a stunning link-in-bio page that showcases all your content, products, and social profiles in one place. Track which links your audience clicks most.

### For Marketing Teams

Organize campaigns, track UTM parameters, and measure ROI across channels. Generate QR codes for print materials and track offline engagement.

### For E-commerce Brands

Shorten product URLs for social media, track traffic sources, and create seasonal campaign pages with rotating links.

### For Media Organizations

Like Vida Económica, use Shortn to track article engagement across platforms, measure campaign effectiveness, and understand your audience's behavior.

### For Event Organizers

Create QR codes for event check-ins, registration links, and sponsor materials. Track scans by location and time.

---

## 🎓 Why I Built This

Shortn was born from a real need in the marketplace. When Vida Económica, one of Portugal's most respected business publications, needed a reliable link management solution, existing platforms couldn't provide the combination of features, customization, and analytics they required.

What started as a solution for one client has evolved into a full-featured platform capable of serving businesses of all sizes. The system has successfully processed over 2.4 million clicks while maintaining 99.9% uptime and sub-second response times.

### Mission

To provide businesses and creators with enterprise-grade link management tools that are powerful yet accessible, with transparent pricing and exceptional performance.

---

## 🛠 Tech Stack

**Frontend**

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI
- React Hook Form + Zod validation

**Backend**

- Node.js
- MongoDB with Mongoose
- Better Auth for authentication
- Polar for payments

**Infrastructure**

- Vercel hosting with edge functions
- MongoDB Atlas
- Pinata for media storage
- Sentry for error monitoring

**Analytics & Integrations**

- Custom analytics engine
- QR code generation and styling
- Email delivery (Resend)
- OAuth providers (Google, GitHub)

---

## 📈 Performance Metrics

- **2.4M+** total clicks processed
- **<50ms** average response time
- **99.9%** uptime
- **Multi-region** deployment for global reach

---

## 🔐 Security & Privacy

Shortn takes security seriously:

- End-to-end encryption for sensitive data
- GDPR-compliant analytics
- Secure payment processing via Polar
- Regular security audits
- Optional password protection for links

---

## 📄 License

This project is proprietary software developed by Ocean Informatix.

For licensing inquiries, please contact [denizgunes@oceaninformatix.com](mailto:denizgunes@oceaninformatix.com)

---

## 📧 Contact

**Developer:** Deniz Güneş  
**Company:** Ocean Informatix  
**Email:** [denizgunes@oceaninformatix.com](mailto:denizgunes@oceaninformatix.com)  
**Website:** [denizlg24.com](https://denizlg24.com)

---

## 🌟 Featured Client

**Vida Económica** - Portugal's leading economic and business magazine has trusted Shortn to power their link management infrastructure, handling millions of clicks with reliability and precision.

---

<div align="center">

**Built with ❤️ by Ocean Informatix**

[Visit Platform](https://shortn.at) • [Contact Us](mailto:denizgunes@oceaninformatix.com)

</div>
