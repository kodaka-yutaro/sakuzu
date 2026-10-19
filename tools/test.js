// お手本どおりに作図すると完成判定になるか、全問題を確かめる
const S = require('../engine.js');
const PROBLEMS = require('../problems.js');
let ng = 0;
for (const prob of PROBLEMS) {
  try {
    const sol = S.runSolution(prob);
    const goal = S.computeGoal(prob);
    const g = S.checkGoal(sol.scene, goal);
    // 途中の状態では完成していないこと
    const half = S.runSolution(prob, prob.steps.length - 1);
    const early = S.checkGoal(half.scene, goal).solved && prob.steps[prob.steps.length - 1].p == null;
    const empty = S.checkGoal(S.buildGiven(prob).scene, goal);
    const ok = g.solved && !early && !empty.solved;
    if (!ok) ng++;
    console.log((ok ? 'OK ' : 'NG ') + prob.slug.padEnd(22) + ' 手数 ' + sol.moves + '  目標 ' + g.done + '/' + g.total + (early ? ' (早すぎる完成)' : ''));
  } catch (e) { ng++; console.log('NG ' + prob.slug + ' ' + e.message); }
}
process.exit(ng ? 1 : 0);
