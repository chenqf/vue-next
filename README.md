# 学习顺序

+ reactivity 数据响应式系统
+ runtime-dom 虚拟dom
+ compiler-dom 编译器

## effect

+ 立即执行,除非指定 {lazy:true}
+ 写操作,但数据没有变更,不会触发
+ 操作原始数据,不会触发
+ 每次effect返回的都是全新的监听函数
+ 可以使用stop终止监听函数继续监听
+ 可以避免隐式递归导致的无限循环
+ 不会阻止显性递归
+ 若内部依赖有逻辑分支,监听每次执行后会重新更新依赖

## effect 第二个参数:ReactiveEffectOptions

+ lazy?: boolean 
    + 延迟计算,true传入的effect不会立即执行
+ computed?: boolean 
    + TODO
+ scheduler?: (run: Function) => void 
    + 调度器函数
+ onTrack?: (event: DebuggerEvent) => void
    + 供调试使用,收集依赖阶段触发
+ onTrigger?: (event: DebuggerEvent) => void 
    + 供调试使用,触发更新后执行监听前执行
+ onStop?: () => void 
    + 通过stop终止监听时触发的事件

## computed

+ 不同于effect,传入的函数不会立即执行
+ 并非每次取值都会触发函数
+ 依赖变更后,不会直接触发函数,取值时才会触发函数

## 遗留问题
+ effect.spec.ts
    + 应该避免自身的隐式无限递归循环  312行
    + 调度器 508行
    + 追踪 533行
    + 触发 572行


## ref 为什么存在

对于基本数据类型，函数传递或者对象解构时，会丢失原始数据的引用，换言之，我们没法让基本数据类型，或者解构后的变量(如果它的值也是基本数据类型的话)，成为响应式的数据。

但是有时候，我们确实就是想一个数字、一个字符串是响应式的，或者就是想利用解构的写法。那怎么办呢？只能通过创建一个对象，也即是源码中的Ref数据，然后将原始数据保存在Ref的属性value当中，再将它的引用返回给使用者。既然是我们自己创造出来的对象，也就没必要使用Proxy再做代理了，直接劫持这个value的get/set即可，这就是ref函数与Ref类型的由来。

不过单靠ref还没法解决对象解构的问题，它只是将基本数据保持在一个对象的value中，以实现数据响应式。对于对象的解构还需要另外一个函数：toRefs。



s

# vue-next [![CircleCI](https://circleci.com/gh/vuejs/vue-next.svg?style=svg&circle-token=fb883a2d0a73df46e80b2e79fd430959d8f2b488)](https://circleci.com/gh/vuejs/vue-next)

## Status: Pre-Alpha.

We have achieved most of the architectural goals and new features planned for v3:

- Compiler
  - [x] Modular architecture
  - [x] "Block tree" optimization
  - [x] More aggressive static tree hoisting
  - [x] Source map support
  - [x] Built-in identifier prefixing (aka "stripWith")
  - [x] Built-in pretty-printing
  - [x] Lean ~10kb brotli-compressed browser build after dropping source map and identifier prefixing

- Runtime
  - [x] Significantly faster
  - [x] Simultaneous Composition API + Options API support, **with typings**
  - [x] Proxy-based change detection
  - [x] Fragments
  - [x] Portals
  - [x] Suspense w/ `async setup()`

However, there are still some 2.x parity features not completed yet:

- [ ] Server-side rendering
- [ ] `<keep-alive>`
- [ ] `<transition>`
- [ ] Compiler DOM-specific transforms
  - [ ] `v-on` DOM modifiers
  - [ ] `v-model`
  - [ ] `v-text`
  - [ ] `v-pre`
  - [ ] `v-once`
  - [ ] `v-html`
  - [ ] `v-show`

The current implementation also requires native ES2015+ in the runtime environment and does not support IE11 (yet).

## Contribution

See [Contributing Guide](https://github.com/vuejs/vue-next/blob/master/.github/contributing.md).
