import { 
    isObject, //判断是否为对象
    toTypeString //获取数据的类型名称
} from '@vue/shared'

// 此处的handles最终会传递给Proxy(target, handle)的第二个参数
import { 
    mutableHandlers, // 可变(object/array)的代理劫持方法
    readonlyHandlers  // 只读(object/array)的代理劫持方法
} from './baseHandlers'

import {
  mutableCollectionHandlers, // 可变(map,set,weakMap,weakSet)的代理劫持方法
  readonlyCollectionHandlers // 只读(map,set,weakMap,weakSet)的代理劫持方法
} from './collectionHandlers'

import { UnwrapNestedRefs } from './ref'

// effect执行后返回的监听函数的类型
import { ReactiveEffect } from './effect'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
export type Dep = Set<ReactiveEffect>
export type KeyToDepMap = Map<string | symbol, Dep>
// 利用WeakMap是为了更好的减少内存开销
export const targetMap: WeakMap<any, KeyToDepMap> = new WeakMap()

// WeakMaps that store {raw <-> observed} pairs.

//原始数据->响应数据 映射表
const rawToReactive: WeakMap<any, any> = new WeakMap()
//响应数据->原始数据 映射表
const reactiveToRaw: WeakMap<any, any> = new WeakMap()

//原始数据->只读响应数据 映射表
const rawToReadonly: WeakMap<any, any> = new WeakMap()
//只读响应数据->原始数据 映射表
const readonlyToRaw: WeakMap<any, any> = new WeakMap()

// WeakSets for values that are marked readonly or non-reactive during
// observable creation.

//只读数据集合
const readonlyValues: WeakSet<any> = new WeakSet()

//非响应数据集合(存放的原始数据)
const nonReactiveValues: WeakSet<any> = new WeakSet()

//集合类型
const collectionTypes: Set<any> = new Set([Set, Map, WeakMap, WeakSet])
//用于正则判断是否符合可观察数据 [object ...]
const observableValueRE = /^\[object (?:Object|Array|Map|Set|WeakMap|WeakSet)\]$/



/**
 * 入参是否可被观察
 */
const canObserve = (value: any): boolean => {
  return (
    !value._isVue && // TODO 未知 _isVue
    !value._isVNode && // 虚拟DOM的节点不可观察
    observableValueRE.test(toTypeString(value)) && // 可观察的对象
    !nonReactiveValues.has(value) // 是否为指定的不可观察对象
  )
}

// 是否是响应式数据
export function isReactive(value: any): boolean {
    return reactiveToRaw.has(value) || readonlyToRaw.has(value)
}

// 是否是只读的响应式诗句
export function isReadonly(value: any): boolean {
    return readonlyToRaw.has(value)
}

/**
 * 通过响应数据获取原始数据
 */
export function toRaw<T>(observed: T): T {
    return reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
}

/**
 * 传递数据，将其添加到只读数据集合中
 * 添加的是原始数据
 */
export function markReadonly<T>(value: T): T {
    readonlyValues.add(value)
    return value
}

/**
 * 传递数据，将其添加至不可响应数据集合中
 * 添加的是原始数据
 */
export function markNonReactive<T>(value: T): T {
    nonReactiveValues.add(value)
    return value
}



export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 如果传递的是只读响应式数据,则直接返回
  if (readonlyToRaw.has(target)) {
    return target
  }
  // target is explicitly marked as readonly by user
  // 如果被用户标记为只读数据,通过readonly去封装
  if (readonlyValues.has(target)) {
    return readonly(target)
  }

  // 保证了target 为非只读数据

  //创建reactive对象
  return createReactiveObject(
    target,
    rawToReactive, // 原始数据 -> 响应式数据映射
    reactiveToRaw, // 响应式数据 -> 原始数据映射
    mutableHandlers, // 可变数据的代理劫持方法
    mutableCollectionHandlers // 可变集合数据的代理劫持方法
  )
}

export function readonly<T extends object>(
  target: T
): Readonly<UnwrapNestedRefs<T>>
export function readonly(target: object) {
  // value is a mutable observable, retrieve its original and return
  // a readonly version.

  // 若为响应数据,获取相应数据的原始值
  if (reactiveToRaw.has(target)) {
    target = reactiveToRaw.get(target)
  }

  return createReactiveObject(
    target,
    rawToReadonly,
    readonlyToRaw,
    readonlyHandlers,
    readonlyCollectionHandlers
  )
}



function createReactiveObject(
  target: any,
  toProxy: WeakMap<any, any>,
  toRaw: WeakMap<any, any>,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  // 不是对象,开发环境提示错误
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // 通过 原始数据->响应数据的映射,获取响应数据
  let observed = toProxy.get(target)
  //如果存在响应数据,直接返回
  if (observed !== void 0) {
    return observed
  }
  // 若传入的原始数据存在响应数据,直接返回响应数据
  if (toRaw.has(target)) {
    return target
  }
  // 传入数据不是一个可观察的对象,直接返回数据
  if (!canObserve(target)) {
    return target
  }

  // 区分 集合数据 和 (object/array) 两种数据的代理方式的不同
  const handlers = collectionTypes.has(target.constructor)
    ? collectionHandlers
    : baseHandlers
  // 声明一个代理对象,即是响应对象
  observed = new Proxy(target, handlers)
  // 设置 原始数据->响应数据 关联关系
  toProxy.set(target, observed)
  // 设置 响应数据->原始数据 关联关系
  toRaw.set(observed, target)

  // 将原始数据存放设至 targetMap ,但为什么要存放,存放的value是什么,并不确定
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map())
  }
  //返回响应数据
  return observed
}


