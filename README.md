<p align="center">
  <picture style="width: 320px">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" />
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h_dark.svg?raw=true" />
    <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/logo/logo_drawnix_h.svg?raw=true" width="360" alt="Drawnix logo and name" />
  </picture>
</p>
<div align="center">
  <h2>
    开源白板工具（SaaS），一体化白板，包含思维导图、流程图、自由画等
  <br />
  </h2>
</div>

<div align="center">
  <figure>
    <a target="_blank" rel="noopener">
      <img src="https://github.com/plait-board/drawnix/blob/develop/apps/web/public/product_showcase/case-2.png" alt="Product showcase" width="80%" />
    </a>
    <figcaption>
      <p align="center">
        All in one 白板，思维导图、流程图、自由画等
      </p>
    </figcaption>
  </figure>
  <a href="https://hellogithub.com/repository/plait-board/drawnix" target="_blank">
    <picture style="width: 250">
      <source media="(prefers-color-scheme: light)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=neutral" />
      <source media="(prefers-color-scheme: dark)" srcset="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=dark" />
      <img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=4dcea807fab7468a962c153b07ae4e4e&claim_uid=zmFSY5k8EuZri43&theme=neutral" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54"/>
    </picture>
  </a>

  <br />

  <a href="https://trendshift.io/repositories/13979" target="_blank"><img src="https://trendshift.io/api/badge/repositories/13979" alt="plait-board%2Fdrawnix | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</div>

[*English README*](https://github.com/plait-board/drawnix/blob/develop/README_en.md)

## 特性

- 💯 免费 + 开源
- ⚒️ 思维导图、流程图
- 🖌 画笔
- 😀 插入图片
- 🚀 基于插件机制
- 🖼️ 📃 导出为 PNG, JSON(`.drawnix`)
- 💾 自动保存（浏览器缓存）
- ⚡ 编辑特性：撤销、重做、复制、粘贴等
- 🌌 无限画布：缩放、滚动
- 🎨 主题模式
- 📱 移动设备适配
- 📈 支持 mermaid 语法转流程图
- ✨ 支持 markdown 文本转思维导图（新支持 🔥🔥🔥）


## 关于名称

***Drawnix***  ，源于绘画(  ***Draw***  )与凤凰(  ***Phoenix***  )的灵感交织。

凤凰象征着生生不息的创造力，而 *Draw* 代表着人类最原始的表达方式。在这里，每一次创作都是一次艺术的涅槃，每一笔绘画都是灵感的重生。

创意如同凤凰，浴火方能重生，而  ***Drawnix***  要做技术与创意之火的守护者。

*Draw Beyond, Rise Above.*


## 与 Plait 画图框架

*Drawnix* 的定位是一个开箱即用、开源、免费的工具产品，它的底层是 *Plait* 框架，*Plait* 是我司开源的一款画图框架，代表着公司在知识库产品([PingCode Wiki](https://pingcode.com/product/wiki?utm_source=drawnix))上的重要技术沉淀。


Drawnix 是插件架构，与前面说到开源工具比技术架构更复杂一些，但是插件架构也有优势，比如能够支持多种 UI 框架（*Angular、React*），能够集成不同富文本框架（当前仅支持 *Slate* 框架），在开发上可以很好的实现业务的分层，开发各种细粒度的可复用插件，可以扩展更多的画板的应用场景。


## 仓储结构

```
drawnix/
├── apps/
│   ├── web                   # drawnix.com
│   │    └── index.html       # HTML
├── dist/                     # 构建产物
├── packages/
│   └── drawnix/              # 白板应用
│   └── react-board/          # 白板 React 视图层
│   └── react-text/           # 文本渲染模块
├── package.json
├── ...
└── README.md
└── README_en.md

```

## 应用

[*https://drawnix.com*](https://drawnix.com) 是 *drawnix* 的最小化应用。

近期会高频迭代 drawnix.com，直到发布 *Dawn（破晓）* 版本。

## iframe 嵌入与工具切换

`Drawnix` 支持嵌入模式（隐藏内置工具栏/设置类 UI），并通过 `postMessage` 从父页面切换当前工具。

```tsx
<Drawnix
  value={[]}
  embedded={true}
  hidePopupToolbar={true}
  iframeControl={{
    enabled: true,
    // 可选：限制消息来源，不传则默认不限制
    allowedOrigins: ['https://your-host.com'],
  }}
/>
```

监听白板加载完成：

```ts
window.addEventListener('message', (event) => {
  if (event.data?.type === 'drawnix:loaded') {
    // 白板初始化完成
  }
});
```

父页面控制示例：

```ts
const iframe = document.getElementById('drawnix-frame') as HTMLIFrameElement;
iframe.contentWindow?.postMessage(
  {
    type: 'drawnix:set-tool',
    tool: 'pen',
  },
  'https://your-drawnix-app.com'
);
```

切换画笔颜色：

```ts
iframe.contentWindow?.postMessage(
  {
    type: 'drawnix:set-pen-color',
    color: '#ff4d4f',
  },
  'https://your-drawnix-app.com'
);
```
> 说明：该事件会更新画笔默认样式，后续新绘制的笔迹会使用新颜色。

切换画笔粗细：

```ts
iframe.contentWindow?.postMessage(
  {
    type: 'drawnix:set-pen-size',
    size: 8,
  },
  'https://your-drawnix-app.com'
);
```
> 说明：该事件会更新画笔默认样式，后续新绘制的笔迹会使用新粗细。

切换橡皮大小：

```ts
iframe.contentWindow?.postMessage(
  {
    type: 'drawnix:set-eraser-size',
    size: 16,
  },
  'https://your-drawnix-app.com'
);
```

当前支持的 `tool` 值：

- `hand`
- `selection`
- `mind`
- `text`
- `pen`（别名：`brush` / `feltTipPen`）
- `eraser`
- `arrow`
- `shape`（矩形）
- `rectangle`

## 数据同步（iframe / React Native WebView）

开启 `iframeControl.enabled` 后，白板会在本地发生变更时通过 `postMessage` 自动发送 `drawnix:change` 事件，外部也可以将远程变更转发回白板实现多端同步。

### 发送的消息

```ts
{
  type: 'drawnix:change',
  payload: {
    children: PlaitElement[],   // 当前画板元素
    operations: PlaitOperation[], // 变更操作列表（已过滤 set_selection）
    viewport: Viewport,           // 当前视口
    selection: Selection | null,  // 当前选区
    senderContainerSize?: { width: number; height: number }, // 发送端容器尺寸
  },
  meta?: { senderId?: string }
}
```

> 说明：
> - `operations` 中 `remove_node` 已剔除 `node` 字段以减少体积。
> - `set_selection` 操作已被过滤，不会同步。
> - `senderContainerSize` 用于接收端按容器宽度比例换算 `zoom`，保证不同分辨率设备看到的内容范围一致，并自动将视口中心对齐。

### iframe 接收与转发示例

父页面监听并转发：

```ts
window.addEventListener('message', (event) => {
  if (event.source === sourceFrame.contentWindow && event.data?.type === 'drawnix:change') {
    // 转发给其它同步端
    targetFrame.contentWindow?.postMessage(event.data, '*');
  }
});
```

### React Native WebView 接收与发送

Drawnix 同时支持 `window.ReactNativeWebView.postMessage` 桥接。在 RN 侧：

```tsx
<WebView
  ref={webViewRef}
  source={{ uri: 'https://your-drawnix-app.com' }}
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'drawnix:change') {
      // 将数据同步到其它端
    }
  }}
  injectedJavaScript={`
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (data?.type === 'drawnix:change') {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    });
  `}
/>
```

RN 向白板发送远程变更：

```ts
webViewRef.current?.postMessage(JSON.stringify({
  type: 'drawnix:change',
  payload: remotePayload,
}));
```

### 最小化转发

接收端实际只依赖 `operations` 和 `senderContainerSize`，因此你可以只转发这两个字段以进一步减少通信体积：

```ts
{
  type: 'drawnix:change',
  payload: {
    operations: remoteOperations,
    senderContainerSize: { width, height },
  }
}
```

### 载入全量数据

当需要初始化或覆盖白板全部数据时，可发送 `drawnix:set-value` 消息：

```ts
iframe.contentWindow?.postMessage(
  {
    type: 'drawnix:set-value',
    payload: {
      children: [...],     // 可选，画板元素列表
      viewport: { ... },   // 可选，视口数据
      senderContainerSize: { width, height }, // 可选，发送端容器尺寸
    },
  },
  '*'
);
```

> 说明：
> - `set-value` 会全量替换对应数据，建议在首次加载或需要重置场景下使用；日常增量同步请继续使用 `drawnix:change`。
> - 携带 `senderContainerSize` 后，接收端会按比例换算 `viewport.zoom` 和 `origination`，保证不同分辨率下展示内容一致。

### 操作类型说明

接收端白板会对收到的 `operations` 逐个调用 `board.apply(op)`。当前涉及的操作类型包括：

- `insert_node` — 插入元素
- `remove_node` — 删除元素（仅依赖 `path`）
- `move_node` — 移动元素
- `set_node` — 修改元素属性
- `set_viewport` — 修改视口（接收端会按分辨率比例换算 `zoom` 和 `origination`）
- `set_theme` — 修改主题

## 开发

```
npm install

npm run start
```

## Docker

```
docker pull pubuzhixing/drawnix:latest
```

## 依赖

- [plait](https://github.com/worktile/plait) - 开源画图框架
- [slate](https://github.com/ianstormtaylor/slate)  - 富文本编辑器框架
- [floating-ui](https://github.com/floating-ui/floating-ui)  - 一个超级好用的创建弹出层基础库



## 贡献

欢迎任何形式的贡献：

- 提 Bug

- 贡献代码

## 感谢支持

特别感谢公司对开源项目的大力支持，也感谢为本项目贡献代码、提供建议的朋友。

<p align="left">
  <a href="https://pingcode.com?utm_source=drawnix" target="_blank">
      <img src="https://cdn-aliyun.pingcode.com/static/site/img/pingcode-logo.4267e7b.svg" width="120" alt="PingCode" />
  </a>
</p>

## License

[MIT License](https://github.com/plait-board/drawnix/blob/master/LICENSE)  
