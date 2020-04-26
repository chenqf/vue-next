import { OperationTypes } from './operations'
import { Dep, targetMap } from './reactive'
import { EMPTY_OBJ, extend } from '@vue/shared'

//监听函数的接口描述
export interface ReactiveEffect {
  (): any
  isEffect: true
  active: boolean
  raw: Function
  deps: Array<Dep>
  computed?: boolean
  scheduler?: (run: Function) => void
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
  onStop?: () => void
}

// 监听函数的配置项
export interface ReactiveEffectOptions {
  // 延迟计算,true时,传入的effect不会立即执行
  lazy?: boolean
  // 是否是computed数据依赖的监听函数
  computed?: boolean
  //调度器函数，接受的入参run即是传给effect的函数，如果传了scheduler，则可通过其调用监听函数
  scheduler?: (run: Function) => void
  //**仅供调试使用**。在收集依赖(get阶段)的过程中触发。
  onTrack?: (event: DebuggerEvent) => void
  //**仅供调试使用**。在触发更新后执行监听函数之前触发。
  onTrigger?: (event: DebuggerEvent) => void
  //通过 `stop` 终止监听函数时触发的事件。
  onStop?: () => void
}

export interface DebuggerEvent {
  effect: ReactiveEffect
  target: any
  type: OperationTypes
  key: string | symbol | undefined
}

export const effectStack: ReactiveEffect[] = []

export const ITERATE_KEY = Symbol('iterate')

/**
 * 用于监听响应式数据的变化
 * @param fn 
 * @param options 
 */
export function effect(
  fn: Function,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect {
  //如果已经是监听函数,将fn重置为原始函数
  if ((fn as ReactiveEffect).isEffect) {
    fn = (fn as ReactiveEffect).raw
  }
  const effect = createReactiveEffect(fn, options)
  //根据lazy,是否立即执行
  if (!options.lazy) {
    effect()
  }
  return effect
}


function createReactiveEffect(
    fn: Function,
    options: ReactiveEffectOptions
  ): ReactiveEffect {
    //创建监听函数,通过run来包裹原函数,做额外操作
    const effect = function effect(...args): any {
      return run(effect as ReactiveEffect, fn, args)
    } as ReactiveEffect
    //监听函数标志位
    effect.isEffect = true
    //可监听执行的状态,stop会将其变为false
    effect.active = true
    //监听函数的原函数
    effect.raw = fn
    effect.scheduler = options.scheduler
    effect.onTrack = options.onTrack
    effect.onTrigger = options.onTrigger
    effect.onStop = options.onStop
    effect.computed = options.computed
    //存放所有存着自身的dep
    effect.deps = []
    return effect
  }


  function run(effect: ReactiveEffect, fn: Function, args: any[]): any {
    //若开关关闭,直接执行并返回
    if (!effect.active) {
      return fn(...args)
    }
    //用于处理监听函数中隐形触发的递归监听,只执行第一次
    //如果监听函数栈中并没有此监听函数，则：
    if (effectStack.indexOf(effect) === -1) {
      //清除原有依赖
      cleanup(effect)
      try {
        //入栈
        effectStack.push(effect)
        //执行原函数
        return fn(...args)
      } finally {
        //出栈
        effectStack.pop()
      }
    }
  }

/**
 * 
 * @param effect 停止监听
 */
export function stop(effect: ReactiveEffect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.onStop) {
      effect.onStop()
    }
    effect.active = false
  }
}




//清除原有依赖,避免分支切换的情况
function cleanup(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

let shouldTrack = true

export function pauseTracking() {
  shouldTrack = false
}

export function resumeTracking() {
  shouldTrack = true
}

// 收集依赖
export function track(
  target: any, // 原始数据
  type: OperationTypes, // 操作类型
  key?: string | symbol // 操作字段
) {
  if (!shouldTrack) {
    return
  }
  //获取栈中最后一个effect
  const effect = effectStack[effectStack.length - 1]

  if (effect) {
    if (type === OperationTypes.ITERATE) {
      key = ITERATE_KEY
    }
    let depsMap = targetMap.get(target)

    if (depsMap === void 0) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key!)
    if (dep === void 0) {
      depsMap.set(key!, (dep = new Set()))
    }
    if (!dep.has(effect)) {
      dep.add(effect)
      effect.deps.push(dep)
      if (__DEV__ && effect.onTrack) {
        effect.onTrack({
          effect,
          target,
          type,
          key
        })
      }
    }
  }
}

//触发监听函数
export function trigger(
  target: any,
  type: OperationTypes,
  key?: string | symbol,
  extraInfo?: any
) {
  // 获取原始数据的响应依赖,没有的话,说明没被监听,直接返回
  const depsMap = targetMap.get(target)
  if (depsMap === void 0) {
    // never been tracked
    return
  }
  // 声明一个effect集合
  const effects: Set<ReactiveEffect> = new Set()
  // 声明一个计算属性集合
  const computedRunners: Set<ReactiveEffect> = new Set()
  // 集合清除操作,执行依赖原始数据的所有监听方法
  if (type === OperationTypes.CLEAR) {
    // collection being cleared, trigger all effects for target
    depsMap.forEach(dep => {
      addRunners(effects, computedRunners, dep)
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      addRunners(effects, computedRunners, depsMap.get(key))
    }
    // also run for iteration key on ADD | DELETE
    if (type === OperationTypes.ADD || type === OperationTypes.DELETE) {
      const iterationKey = Array.isArray(target) ? 'length' : ITERATE_KEY
      addRunners(effects, computedRunners, depsMap.get(iterationKey))
    }
  }
  const run = (effect: ReactiveEffect) => {
    scheduleRun(effect, target, type, key, extraInfo)
  }
  // Important: computed effects must be run first so that computed getters
  // can be invalidated before any normal effects that depend on them are run.

  // 运行所有计算数据的监听方法
  computedRunners.forEach(run)
  // 运行所有寻常的监听函数
  effects.forEach(run)
}

function addRunners(
  effects: Set<ReactiveEffect>,
  computedRunners: Set<ReactiveEffect>,
  effectsToAdd: Set<ReactiveEffect> | undefined
) {
  if (effectsToAdd !== void 0) {
    effectsToAdd.forEach(effect => {
      if (effect.computed) {
        computedRunners.add(effect)
      } else {
        effects.add(effect)
      }
    })
  }
}

function scheduleRun(
  effect: ReactiveEffect,
  target: any,
  type: OperationTypes,
  key: string | symbol | undefined,
  extraInfo: any
) {
  if (__DEV__ && effect.onTrigger) {
    effect.onTrigger(
      extend(
        {
          effect,
          target,
          key,
          type
        },
        extraInfo
      )
    )
  }
  if (effect.scheduler !== void 0) {
    effect.scheduler(effect)
  } else {
    effect()
  }
}
