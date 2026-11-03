# Zoiko-Sports-Platform

Admin dashboard for Zoiko Sports. Built with Next.js 16 (App Router) and Tailwind CSS v4, with a neumorphic UI in the logo palette and light/dark themes.

## Run

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /login
```

Demo sign-in: any valid email and a password of 6+ characters.

The sidebar collapses to an icon rail with the « button or Ctrl/Cmd+B (remembered per browser).

## Structure

- `src/app/login` – sign-in page
- `src/app/dashboard` – dashboard layout, home page and skeleton loader
- `src/app/dashboard/{feed,tipsters,hot-tips,users,payouts,settings}` – sidebar sections
- `src/app/dashboard/leagues/[slug]`, `clubs/[slug]` – favourite league / club pages
- `src/components/views` – client views for each section
- `src/app/globals.css` – brand tokens, neumorphic utilities (`neu`, `neu-inset`, `neu-btn`, `neu-card`, `shine`), animations
- `src/components/brand` – logo, SVG ball, bouncing-ball loader
- `src/components/dashboard` – sidebar, top bar, hero match, KPIs, games list, right panel
- `src/components/theme` – theme provider (saved to localStorage, circular reveal on switch) and toggle
- `src/lib/data.ts` – mock data; replace with API calls
