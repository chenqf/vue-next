import { reactive, readonly, toRaw } from './reactive'
import { OperationTypes } from './operations'
// 收集依赖跟触发监听函数的两个方法
import { track, trigger } from './effect'
// 一个全局用来判断是否数据是不可变的开关--应用于只读响应数据
import { LOCKED } from './lock'
import { isObject, hasOwn } from '@vue/shared'
import { isRef } from './ref'

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => (Symbol as any)[key])
    .filter(value => typeof value === 'symbol')
)


function createGetter(isReadonly: boolean) {
  return function get(target: any, key: string | symbol, receiver: any) {
    //获取原始数据的相应值
    const res = Reflect.get(target, key, receiver)
    //若为js的内置方法,不做依赖收集
    if (typeof key === 'symbol' && builtInSymbols.has(key)) {
      return res
    }
    //若为Ref类型,已经被收集过依赖,不做依赖收集,直接返回value
    if (isRef(res)) {
      return res.value
    }
    //依赖收集
    track(target, OperationTypes.GET, key)

    //若值不是对象,直接返回,若是对象,生成响应对象返回
    //为了避免循环引用以及性能的问题,没有在生成reactive的阶段递归生成proxy
    //改为在get阶段生成内层对象的reactive
    return isObject(res)
      ? isReadonly
        ? readonly(res)
        : reactive(res)
      : res
  }
}

function set(
  target: any,
  key: string | symbol,
  value: any,
  receiver: any
): boolean {
  // 若value是响应数据,获取起原始值
  value = toRaw(value)
  // 获取修改前的值
  const oldValue = target[key]
  // 修改前的值是Ref,新值不是Ref,更新Ref的value
  if (isRef(oldValue) && !isRef(value)) {
    oldValue.value = value
    return true
  }
  //是否有这个值,没有代表新增
  const hadKey = hasOwn(target, key)
  //将本次行为反映到原始数据中
  const result = Reflect.set(target, key, value, receiver)
  // don't trigger if target is something up in the prototype chain of original
  //如果是原型链上的数据操作,不做监听行为
  if (target === toRaw(receiver)) {
    /* istanbul ignore else */
    //开发环境多传递一个新旧值,用于调试
    if (__DEV__) {
      const extraInfo = { oldValue, newValue: value }
      //新增
      if (!hadKey) {
        trigger(target, OperationTypes.ADD, key, extraInfo)
      } 
      //修改
      else if (value !== oldValue) {
        trigger(target, OperationTypes.SET, key, extraInfo)
      }
    } else {
      if (!hadKey) {
        trigger(target, OperationTypes.ADD, key)
      } else if (value !== oldValue) {
        trigger(target, OperationTypes.SET, key)
      }
    }
  }
  return result
}

function deleteProperty(target: any, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = target[key]
  const result = Reflect.deleteProperty(target, key)
  if (hadKey) {
    /* istanbul ignore else */
    if (__DEV__) {
      trigger(target, OperationTypes.DELETE, key, { oldValue })
    } else {
      trigger(target, OperationTypes.DELETE, key)
    }
  }
  return result
}

function has(target: any, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  track(target, OperationTypes.HAS, key)
  return result
}

function ownKeys(target: any): (string | number | symbol)[] {
  track(target, OperationTypes.ITERATE)
  return Reflect.ownKeys(target)
}

export const mutableHandlers: ProxyHandler<any> = {
  get: createGetter(false),
  set,
  deleteProperty,
  has,
  ownKeys
}

export const readonlyHandlers: ProxyHandler<any> = {
  get: createGetter(true),

  set(target: any, key: string | symbol, value: any, receiver: any): boolean {
    if (LOCKED) {
      if (__DEV__) {
        console.warn(
          `Set operation on key "${key as any}" failed: target is readonly.`,
          target
        )
      }
      return true
    } else {
      return set(target, key, value, receiver)
    }
  },

  deleteProperty(target: any, key: string | symbol): boolean {
    if (LOCKED) {
      if (__DEV__) {
        console.warn(
          `Delete operation on key "${key as any}" failed: target is readonly.`,
          target
        )
      }
      return true
    } else {
      return deleteProperty(target, key)
    }
  },

  has,
  ownKeys
}
