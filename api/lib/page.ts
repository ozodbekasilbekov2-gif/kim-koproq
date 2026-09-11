export const page = () => `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Kim ko'proq...? — 2AF1 so'rovi</title>
<meta name="description" content="2AF1 guruhi uchun qiziqarli so'rov. Kim ko'proq...?">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
<link href="/static/style.css?v=2" rel="stylesheet">
<link rel="icon" href="/static/favicon.ico">
</head>
<body class="min-h-screen text-white">
  <div class="bg-glow"></div>
  <header id="site-header" class="sticky top-0 z-30 backdrop-blur-md bg-black/40 border-b border-white/10">
    <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
      <a href="#" id="brand" class="brand text-2xl tracking-wide"><i class="fas fa-bolt text-yellow-400 mr-2"></i>KIM KO'PROQ...?</a>
      <nav class="flex items-center gap-2 text-sm">
        <button id="nav-questions" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition hidden" title="Savollarni tahrirlash"><i class="fas fa-pen-to-square mr-1"></i><span class="hidden sm:inline">Savollar</span></button>
        <button id="nav-results" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"><i class="fas fa-chart-simple mr-1"></i><span class="hidden sm:inline">Natijalar</span></button>
        <button id="nav-reset" class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition hidden" title="Boshqa odam sifatida kirish"><i class="fas fa-user-pen"></i></button>
      </nav>
    </div>
  </header>
  <main id="app" class="max-w-5xl mx-auto px-4 py-6 pb-28"></main>
  <footer class="text-center text-xs text-white/40 py-6">2AF1 · Guruh so'rovi 2026</footer>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>
  <script src="/static/app.js?v=2"></script>
</body>
</html>`
