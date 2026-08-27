# Self67Toys

把 [Self67Fanfic](https://github.com/Cynanchum0109/Self67Fanfic) 里的四个小游戏改造成两个可以发布到 **哔哩哔哩 Toy 平台** 的独立作品。原仓库不受影响。

## 两个 Toy

| 目录 | 内容 | 产物 |
|---|---|---|
| `apps/hatchery` | 孵化场（类吸血鬼幸存者），带 Toy 排行榜 | `dist/hatchery` |
| `apps/arcade` | 菜单 + R公司孵化场观测 / UFO 抓狗 / 碰到就要结婚喔～ | `dist/arcade` |

## 开发

```bash
npm install
npm run dev:hatchery     # http://localhost:3000
npm run dev:arcade
npm run build            # 同时构建两个，输出到 dist/
```

`npm run preview:hatchery` / `preview:arcade` 可以预览构建产物。

## Toy 平台适配要点

- `base: './'`：Toy 把作品挂在 `bilibilitoy.com/toy/<slug>/<id>-v2/` 下，绝对路径会 404。
- `index.html` 里引入官方 SDK：`https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js`，注入 `window.toy`。
- 不外链字体、不使用 Tailwind CDN：Tailwind 走本地构建，字体用系统栈。
- 上传体积限制 140MB，当前两个产物各不到 1MB。

## 排行榜

只有孵化场接了排行榜（`RANK_BOARD = 1`）。Toy 榜单只接受一个整数，所以把「击杀数 + 用时」压成一个分数（`src/shared/toy.ts`）：

```
score = 击杀数 * 100000 + (99999 - 用时厘秒)
```

击杀多的一定排在前面；击杀数相同时，用时短的余数更大，也排在前面。展示时再解码回「N 杀 · M 秒」。

非 Toy 环境（本地预览、直接打开）下 SDK 调用不会返回，所有调用都带 6 秒超时并降级提示。

## 相对原仓库的改动

- 剥掉小说阅读器、密码门、`text/` 与 `storiesData`，只保留游戏。
- RCop 观测：删除全部台词系统（`speech/` 四个文件、气泡调度与渲染）。
- 恐龙跳：画面点击 / 触屏即可开始与跳跃。
- 孵化场：英文副标题 `Survival guaranteed.` 改为 `Ensure your own survival.`；新增排行榜面板与成绩上传。
- 两个作品都保留中英切换，语言选择存在 `localStorage`。
