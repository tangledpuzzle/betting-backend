import Redis from 'ioredis'
import { Presence } from '@colyseus/core'
import type { RedisOptions } from 'ioredis'

type Callback = (...args: any[]) => void

export default class RedisPresence implements Presence {
  public sub: Redis
  public pub: Redis

  protected subscriptions: { [channel: string]: Callback[] } = {}

  constructor(opts?: RedisOptions) {
    this.sub = new Redis(opts)
    this.pub = new Redis(opts)

    // no listener limit
    this.sub.setMaxListeners(0)
  }

  public async subscribe(topic: string, callback: Callback) {
    if (!this.subscriptions[topic]) {
      this.subscriptions[topic] = []
    }

    this.subscriptions[topic].push(callback)

    if (this.sub.listeners('message').length === 0) {
      this.sub.on('message', this.handleSubscription)
    }

    await this.sub.subscribe(topic)

    return this
  }

  public async unsubscribe(topic: string, callback?: Callback) {
    const topicCallbacks = this.subscriptions[topic]
    if (!topicCallbacks) {
      return
    }

    if (callback) {
      const index = topicCallbacks.indexOf(callback)
      topicCallbacks.splice(index, 1)
    } else {
      this.subscriptions[topic] = []
    }

    if (this.subscriptions[topic].length === 0) {
      delete this.subscriptions[topic]
      await this.sub.unsubscribe(topic)
    }

    return this
  }

  public async publish(topic: string, data: any) {
    if (data === undefined) {
      data = false
    }

    await this.pub.publish(topic, JSON.stringify(data))
  }

  public async exists(roomId: string): Promise<boolean> {
    return (await (this.pub as any).pubsub('channels', roomId)).length > 0
  }

  public async setex(key: string, value: string, seconds: number) {
    return new Promise(resolve => this.pub.setex(key, seconds, value, resolve))
  }

  public async get(key: string) {
    return new Promise((resolve, reject) => {
      this.pub.get(key, (err, data) => {
        if (err) {
          return reject(err)
        }
        resolve(data)
      })
    })
  }

  public async del(roomId: string) {
    return new Promise(resolve => {
      this.pub.del(roomId, resolve)
    })
  }

  public async sadd(key: string, value: any) {
    return new Promise(resolve => {
      this.pub.sadd(key, value, resolve)
    })
  }

  public async smembers(key: string): Promise<string[]> {
    return this.pub.smembers(key)
  }

  public async sismember(key: string, field: string): Promise<number> {
    return this.pub.sismember(key, field)
  }

  public async srem(key: string, value: any) {
    return this.pub.srem(key, value)
  }

  public async scard(key: string) {
    return this.pub.scard(key)
  }

  public async sinter(...keys: string[]) {
    return this.pub.sinter(...keys)
  }

  public async hset(key: string, field: string, value: string) {
    return this.pub.hset(key, field, value)
  }

  public async hincrby(key: string, field: string, value: number) {
    return this.pub.hincrby(key, field, value)
  }

  public async hget(key: string, field: string) {
    return this.pub.hget(key, field)
  }

  public async hgetall(key: string) {
    return this.pub.hgetall(key)
  }

  public async hdel(key: string, field: string) {
    return this.pub.hdel(key, field)
  }

  public async hlen(key: string): Promise<number> {
    return this.pub.hlen(key)
  }

  public async incr(key: string): Promise<number> {
    return this.pub.incr(key)
  }

  public async decr(key: string): Promise<number> {
    return this.pub.decr(key)
  }

  public shutdown() {
    this.sub.quit()
    this.pub.quit()
  }

  protected handleSubscription = (channel: string, message: any) => {
    if (this.subscriptions[channel]) {
      for (let i = 0, l = this.subscriptions[channel].length; i < l; i++) {
        this.subscriptions[channel][i](JSON.parse(message))
      }
    }
  }
}
