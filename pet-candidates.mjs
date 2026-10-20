const repos = ['xpy12367/codex-pet-DeepSeek-girl', 'YuSec2021/blue-whale-maid'];
for (const repo of repos) {
  console.log(`\n===== ${repo} =====`);
  const t = await (await fetch(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`)).json();
  if (!t.tree) { console.log('ERR', JSON.stringify(t).slice(0,150)); continue; }
  for (const e of t.tree) {
    if (/\.(webp|png|json)$/i.test(e.path) || /readme|license/i.test(e.path)) {
      console.log(`  ${String(e.size ?? '').padEnd(9)} ${e.path}`);
    }
  }
}
