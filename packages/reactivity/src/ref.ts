import { track, trigger } from './effect'
import { OperationTypes } from './operations'
import { isObject } from '@vue/shared'
import { reactive } from './reactive'

//生成唯一key
export const refSymbol = Symbol()
export type RefSymbol = typeof refSymbol

//声明Ref接口
export interface Ref<T> {
  //用于判断是否为Ref
  _isRef: RefSymbol
  //存放真正数据的地方
  value: UnwrapNestedRefs<T>
}

export type UnwrapNestedRefs<T> = T extends Ref<any> ? T : UnwrapRef<T>

//判断是否是Ref
export function isRef(v: any): v is Ref<any> {
    return v ? v._isRef === refSymbol : false
}

/**
 * 对象转换为reactive
 * 普通数据直接返回
 * @param val 
 */
const convert = (val: any): any => (isObject(val) ? reactive(val) : val)

/**
 * 实现非对象数据的劫持
 * @param raw 
 */
export function ref<T>(raw: T): Ref<T> {
  raw = convert(raw)
  const v = {
    _isRef: refSymbol,
    get value() {
      // 收集依赖
      track(v, OperationTypes.GET, '')
      // 返回转化后的数据
      return raw
    },
    set value(newVal) {
      raw = convert(newVal)
      // 触发监听执行
      trigger(v, OperationTypes.SET, '')
    }
  }
  return v as Ref<T>
}



/**
 * 将对象的第一层转化为Ref类型
 * @param object 
 */
export function toRefs<T extends object>(
  object: T
): { [K in keyof T]: Ref<T[K]> } {
  const ret: any = {}
  //遍历所有key,将其值转化为Ref数据
  for (const key in object) {
    ret[key] = toProxyRef(object, key)
  }
  return ret
}

function toProxyRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): Ref<T[K]> {
  const v = {
    _isRef: refSymbol,
    get value() {
      // 注意，这里没用到track
      return object[key]
    },
    set value(newVal) {
      // 注意，这里没用到trigger
      object[key] = newVal
    }
  }
  return v as Ref<T[K]>
}

//不应该继续递归的引用数据类型
type BailTypes =
  | Function
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>

// Recursively unwraps nested value bindings.
// Unfortunately TS cannot do recursive types, but this should be enough for
// practical use cases...

//递归地获取嵌套数据的类型
export type UnwrapRef<T> = T extends Ref<infer V>
  ? UnwrapRef2<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef2<V>>
    : T extends BailTypes
      ? T // bail out on types that shouldn't be unwrapped
      : T extends object ? { [K in keyof T]: UnwrapRef2<T[K]> } : T

type UnwrapRef2<T> = T extends Ref<infer V>
  ? UnwrapRef3<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef3<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef3<T[K]> } : T

type UnwrapRef3<T> = T extends Ref<infer V>
  ? UnwrapRef4<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef4<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef4<T[K]> } : T

type UnwrapRef4<T> = T extends Ref<infer V>
  ? UnwrapRef5<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef5<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef5<T[K]> } : T

type UnwrapRef5<T> = T extends Ref<infer V>
  ? UnwrapRef6<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef6<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef6<T[K]> } : T

type UnwrapRef6<T> = T extends Ref<infer V>
  ? UnwrapRef7<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef7<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef7<T[K]> } : T

type UnwrapRef7<T> = T extends Ref<infer V>
  ? UnwrapRef8<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef8<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef8<T[K]> } : T

type UnwrapRef8<T> = T extends Ref<infer V>
  ? UnwrapRef9<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef9<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef9<T[K]> } : T

type UnwrapRef9<T> = T extends Ref<infer V>
  ? UnwrapRef10<V>
  : T extends Array<infer V>
    ? Array<UnwrapRef10<V>>
    : T extends BailTypes
      ? T
      : T extends object ? { [K in keyof T]: UnwrapRef10<T[K]> } : T

type UnwrapRef10<T> = T extends Ref<infer V>
  ? V // stop recursion
  : T
