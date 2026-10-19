// problems.js から各ページと sitemap.xml を生成する： node tools/build.js
const fs = require('fs');
const path = require('path');
const S = require('../engine.js');
const PROBLEMS = require('../problems.js');

const ROOT = path.join(__dirname, '..');
const ORIGIN = 'https://sakuzu.kdking-tools.com';
const SITE = 'SakuzuMaster';
const TODAY = new Date().toISOString().slice(0, 10);
const ADSENSE = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5667454303064752" crossorigin="anonymous"></script>';
const LEVELS = { 1: '入門', 2: '基本', 3: '応用', 4: '難しい', 5: 'マスター' };
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const GENRES = PROBLEMS.GENRES;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = s => s.replace(/<[^>]+>/g, '');

function page({ file, title, desc, body, ld, type }) {
  const depth = file.split('/').length - 1;
  const up = '../'.repeat(depth);
  const url = ORIGIN + '/' + file.replace(/index\.html$/, '');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type || 'article'}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
${ld ? '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>\n' : ''}<link rel="stylesheet" href="${up}style.css?v=3">
${ADSENSE}
</head>
<body>
<header class="appbar"><div class="wrap appbar-in">
  <a class="brand" href="${up || './'}"><span class="brand-mark" aria-hidden="true"></span>${SITE}</a>
  <nav class="appnav" aria-label="サイト内"><a href="${up || './'}">Problems</a><a href="${up}yomimono/fukanou.html">読み物</a><a href="${up}about.html">About</a></nav>
  <a class="appbar-ac" href="${up || './'}" data-progress-mini hidden></a>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="site-footer"><div class="wrap">
  <a href="${up || './'}">問題一覧</a> ・ <a href="${up}yomimono/fukanou.html">作図できない問題</a> ・ <a href="${up}about.html">運営者情報・お問い合わせ</a> ・ <a href="${up}privacy.html">プライバシーポリシー</a><br>
  <a href="https://kdking-tools.com/">kdking tools</a> のサイトのひとつです。 © 2026 kdking
</div></footer>
</body>
</html>
`;
}

const written = [];
function write(file, html, lastmod) {
  const full = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
  written.push({ file, lastmod: lastmod || TODAY });
}

// ---- 問題ページ ----
PROBLEMS.forEach((p, i) => {
  const prev = PROBLEMS[i - 1], next = PROBLEMS[i + 1];
  const steps = p.steps.filter(S.isFrame).map(s => '<li>' + s.say + '</li>').join('\n');
  const title = `${p.title}の作図｜手順と解説 - ${SITE}`;
  const desc = `${p.lead} コンパスと定規を実際に動かして作図に挑戦できます。手順と「なぜこれで作図できるのか」もくわしく解説します。`;
  const body = `<nav class="crumbs"><a href="../">問題一覧</a> › ${p.genre} › ${p.title}</nav>
<article class="article">
<h1>${p.title}の作図</h1>
<p class="meta"><span class="chip" data-status-slug="${p.slug}">未AC</span><span>問題 ${i + 1} / ${PROBLEMS.length}</span><span>${p.genre}</span><span>難しさ <span class="stars" aria-label="5段階中${p.level}">${stars(p.level)}</span> ${LEVELS[p.level]}</span></p>
<p class="lead"><b>問題：</b>${p.lead}</p>
<div data-sakuzu="${p.slug}" tabindex="-1"></div>
<p class="muted">道具を選んで、点をタップ（クリック）して作図します。線や円の交点は自動で点になります。何もない所をドラッグすると図を動かせます。</p>
<div class="ad-slot" aria-label="広告"></div>
<h2>作図の手順</h2>
<details class="box"><summary>手順を表示する（ネタバレ注意）</summary>
<ol class="steps">
${steps}
</ol>
</details>
<h2>なぜこれで作図できるのか</h2>
<details class="box"><summary>解説を表示する（ネタバレ注意）</summary>
${p.why.map(t => '<p>' + t + '</p>').join('\n')}
</details>
${p.trivia ? '<h2>豆知識</h2>\n' + p.trivia.map(t => '<p>' + t + '</p>').join('\n') : ''}
<nav class="pager">${prev ? `<a class="button" href="${prev.slug}.html">← ${prev.title}</a>` : '<span></span>'}${next ? `<a class="button primary" href="${next.slug}.html">次の問題：${next.title} →</a>` : '<a class="button" href="../">問題一覧へ</a>'}</nav>
<h2>コメント</h2>
<p class="muted">解き方の工夫や、もっと少ない手数の作図などを自由に書きこんでください。（GitHub アカウントでコメントできます）</p>
<div id="comments"></div>
<div class="ad-slot" aria-label="広告"></div>
</article>
<script src="../problems.js?v=3"></script>
<script src="../engine.js?v=4"></script>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: p.title + 'の作図', description: strip(p.lead), inLanguage: 'ja', datePublished: '2026-10-19', dateModified: TODAY, url: `${ORIGIN}/problems/${p.slug}.html`, author: { '@type': 'Person', name: 'kdking' }, publisher: { '@type': 'Organization', name: SITE } };
  write(`problems/${p.slug}.html`, page({ file: `problems/${p.slug}.html`, title, desc, body, ld }));
});

// ---- トップ（問題一覧）----
const groups = GENRES.map((g, gi) => {
  const items = PROBLEMS.map((p, i) => ({ p, i })).filter(({ p }) => p.genre === g);
  const rows = items.map(({ p, i }) => `<tr data-slug="${p.slug}">
<td class="c-num">${i + 1}</td>
<td class="c-title"><a href="problems/${p.slug}.html">${p.title}</a><span class="sub">${p.short}</span></td>
<td class="c-lv"><span class="stars" aria-label="5段階中${p.level}">${stars(p.level)}</span> <span class="lvname">${LEVELS[p.level]}</span></td>
<td class="c-st"><span class="chip">未AC</span></td>
</tr>`).join('\n');
  return `<section class="category" data-cat="${g}" id="g${gi + 1}">
<h2>${g} <span class="cat-count" data-cat-count="${g}">0 / ${items.length}</span><span class="complete-badge" hidden>COMPLETE</span></h2>
<div class="table-scroll"><table class="plist">
<thead><tr><th class="c-num">#</th><th class="c-title">問題</th><th class="c-lv">難しさ</th><th class="c-st">状態</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>
</section>`;
}).join('\n');
const topBody = `<section class="hero">
<h1>Problems</h1>
<p class="lead">コンパスと定規だけで、どこまで作図できますか。正三角形や垂直二等分線から、正五角形、黄金比、コンパスだけで中点を求める作図まで、全${PROBLEMS.length}問。画面の上で実際に作図して、AC（完成）を集めましょう。</p>
</section>
<section class="progress-card" aria-label="コンプリート状況">
<div class="progress-nums">
  <div><span class="big" data-count-ac>0</span><span class="of">/ ${PROBLEMS.length}</span><span class="lbl">AC</span></div>
</div>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${PROBLEMS.length}" aria-valuenow="0" data-bar><span class="bar-ac"></span></div>
<p class="progress-msg" data-progress-msg>まずは「正三角形」から始めてみましょう。</p>
</section>
<nav class="genre-nav" aria-label="ジャンル">${GENRES.map((g, gi) => `<a href="#g${gi + 1}">${g} <span data-cat-count="${g}">0 / ${PROBLEMS.filter(p => p.genre === g).length}</span></a>`).join('')}</nav>
<div class="ad-slot" aria-label="広告"></div>
${groups}
<section class="box">
<h2>作図のルール</h2>
<p>ここでいう「作図」は、古代ギリシャ以来のルールにしたがいます。</p>
<ul>
<li>定規でできるのは、2つの点を通る直線を引くことだけです。目盛りで長さをはかることはできません。</li>
<li>コンパスでできるのは、中心の点と、円が通る点を決めて円をかくことだけです。</li>
<li>点は、線や円の交点のほか、好きな場所（線や円の上を含む）にとることができます。ただし、答えが「たまたまとった点」に頼ってはいけません。</li>
</ul>
<p>「長さを写す」道具は、コンパスの幅を保ったまま別の場所に円をかく操作です。ユークリッドの『原論』で、ふつうのコンパスだけでも同じことができると示されているので、便利な道具として使えるようにしています。</p>
<p>このルールでは作図できないものもあります。<a href="yomimono/fukanou.html">作図できない問題（角の三等分・正七角形など）</a>もあわせて読んでみてください。</p>
</section>
<div class="ad-slot" aria-label="広告"></div>
<script src="problems.js?v=3"></script>
<script src="engine.js?v=4"></script>`;
write('index.html', page({
  file: 'index.html', type: 'website',
  title: `SakuzuMaster｜コンパスと定規の作図問題を手を動かして解く（正五角形・垂直二等分線ほか）`,
  desc: 'コンパスと定規の作図問題を、画面の上で実際に作図しながら解けるサイト。正三角形・垂直二等分線・角の二等分線から、正五角形・黄金比・コンパスだけの作図まで、手順と解説つきで紹介します。',
  ld: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE, url: ORIGIN + '/', inLanguage: 'ja' },
  body: topBody,
}));

// ---- 読み物：作図できない問題 ----
write('yomimono/fukanou.html', page({
  file: 'yomimono/fukanou.html',
  title: `作図できない問題｜角の三等分・立方体倍積・円積問題と正十七角形 - ${SITE}`,
  desc: 'コンパスと定規では作図できない「三大作図問題」（角の三等分・立方体の倍積・円積問題）と、作図できる正多角形・できない正多角形の見分け方を、やさしく紹介します。',
  body: `<nav class="crumbs"><a href="../">問題一覧</a> › 読み物</nav>
<article class="article">
<h1>作図できない問題</h1>
<p class="lead">コンパスと定規があれば、正三角形も正五角形も、黄金比も作図できます。それなら、どんな図形でも作図できるのでしょうか。実は、2000年以上も人々を悩ませた末に「絶対にできない」と証明された問題があります。</p>
<h2>古代ギリシャの三大作図問題</h2>
<p>古代ギリシャの数学者たちは、次の3つの問題をコンパスと定規だけで解こうとしました。</p>
<ul>
<li><b>角の三等分</b>：どんな角でも、3つの等しい角に分ける。</li>
<li><b>立方体の倍積</b>：ある立方体の2倍の体積をもつ立方体の1辺を作る（1辺が ∛2 倍の線分を作る）。</li>
<li><b>円積問題</b>：ある円と同じ面積の正方形を作る（長さ √π の線分を作る）。</li>
</ul>
<p>角の<a href="../problems/kaku-no-nitoubunsen.html">二等分</a>は簡単なのに、三等分は誰にもできませんでした。</p>
<h2>なぜできないのか</h2>
<p>作図で新しい点ができるのは、直線と直線、直線と円、円と円の交点だけです。これを式で表すと、交点の座標は、もとの長さから「たし算・ひき算・かけ算・わり算」と「平方根（√）」をくり返して作れる数になります。</p>
<p>つまり、作図できる長さは、四則演算と √ の組み合わせで表せる数に限られます。ところが ∛2 は、この形ではけっして表せません。1837年、フランスのヴァンツェルがこのことを証明し、立方体の倍積が不可能だと示しました。同じ考え方で、たとえば 60° の角を三等分すること（20° の角を作ること）もできないとわかり、角の三等分の一般的な方法は存在しないことが示されました。</p>
<p>円積問題は、1882年にリンデマンが「π は超越数（どんな整数係数の方程式の解にもならない数）である」ことを証明して、不可能だと決着しました。</p>
<h2>作図できる正多角形</h2>
<p>正三角形、正方形、<a href="../problems/seigokakkei.html">正五角形</a>、<a href="../problems/seirokkakkei.html">正六角形</a>は作図できます。では正七角形は？ 実は作図できません。</p>
<p>1796年、18歳のガウスは<b>正十七角形</b>が作図できることを発見しました。ガウスはこの発見がとてもうれしく、数学者になる決心をしたといわれています。</p>
<p>正n角形が作図できるのは、n が「2のべき乗」と「異なるフェルマー素数（3, 5, 17, 257, 65537）」のかけ算で表せるときだけです。20以下で作図できるのは次の11種類です。</p>
<p class="box">3, 4, 5, 6, 8, 10, 12, 15, 16, 17, 20</p>
<p>7, 9, 11, 13, 14, 18, 19 の正多角形は、コンパスと定規では作図できません。</p>
<h2>ルールを変えると…</h2>
<p>折り紙を使うと、角の三等分も立方体の倍積もできることが知られています。また、定規に2つの印をつけてよい（ネウシス）なら、角の三等分ができます。作図の「できる・できない」は、使ってよい道具によって変わるのです。</p>
<p>一方で、定規を使わず<a href="../problems/compass-dake-chuuten.html">コンパスだけ</a>にしても、作図できる点は変わりません（モール＝マスケローニの定理）。</p>
<nav class="pager"><a class="button" href="../">問題一覧へ</a></nav>
<div class="ad-slot" aria-label="広告"></div>
</article>`,
}));

// ---- 運営者情報・プライバシーポリシー ----
write('about.html', page({
  file: 'about.html', title: `運営者情報・お問い合わせ | ${SITE}`, desc: 'コンパスと定規の作図サイト「SakuzuMaster」の運営者情報とお問い合わせ先です。',
  body: `<section class="box">
<h1>運営者情報</h1>
<p>サイト名：${SITE}<br>運営者：kdking<br>URL：<a href="${ORIGIN}/">${ORIGIN}/</a></p>
<p>コンパスと定規の作図を「手を動かして」楽しむための無料サイトとして、個人で開発・運営しています。</p>
<h2>お問い合わせ</h2>
<p>不具合のご報告やご要望は、<a href="https://github.com/kodaka-yutaro/sakuzu/issues" rel="noopener">GitHub の Issues</a> からお寄せください。</p>
</section>`,
}));
write('privacy.html', page({
  file: 'privacy.html', title: `プライバシーポリシー | ${SITE}`, desc: '「SakuzuMaster」のプライバシーポリシーです。',
  body: `<section class="box">
<h1>プライバシーポリシー</h1>
<h2>広告の配信について</h2>
<p>当サイトでは、第三者配信の広告サービス（Google アドセンス）を利用しています。広告配信事業者は、ユーザーの興味に応じた広告を表示するために Cookie を使用することがあります。Cookie を無効にする方法や Google アドセンスに関する詳細は、<a href="https://policies.google.com/technologies/ads?hl=ja" rel="noopener">Google の「広告」に関するページ</a>をご確認ください。</p>
<h2>アクセス解析について</h2>
<p>当サイトでは、サイト改善のためにアクセス解析ツールを利用する場合があります。データは匿名で収集され、個人を特定するものではありません。</p>
<h2>コメント欄について</h2>
<p>各問題ページのコメント欄は、GitHub Discussions を利用した「giscus」で提供しています。コメントするには GitHub アカウントでのログインが必要で、書きこんだ内容は GitHub 上に公開されます。GitHub での個人情報の扱いは、GitHub のプライバシーポリシーにしたがいます。</p>
<h2>データの保存について</h2>
<p>作図を完成させた記録（問題ごとの手数）は、お使いのブラウザ内（localStorage）にのみ保存され、運営者のサーバーへ送信されることはありません。</p>
<h2>免責事項</h2>
<p>当サイトの情報の正確性には注意を払っていますが、その内容を保証するものではありません。</p>
<h2>お問い合わせ</h2>
<p>お問い合わせは<a href="about.html">運営者情報・お問い合わせ</a>のページからお願いします。</p>
<p>制定日：2026年10月19日</p>
</section>`,
}));

// ---- sitemap.xml ----
const order = ['index.html', ...PROBLEMS.map(p => `problems/${p.slug}.html`), 'yomimono/fukanou.html', 'about.html', 'privacy.html'];
const urls = order.map(f => written.find(w => w.file === f)).map(w => `  <url><loc>${ORIGIN}/${w.file.replace(/index\.html$/, '')}</loc><lastmod>${w.lastmod}</lastmod></url>`);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
console.log('生成：' + written.length + ' ページ + sitemap.xml');
