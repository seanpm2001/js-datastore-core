import sort from 'it-sort'
import drain from 'it-drain'
import filter from 'it-filter'
import take from 'it-take'
import type { Batch, Datastore, Key, KeyQuery, Options, Pair, Query } from 'interface-datastore'
import type { AwaitIterable } from 'interface-store'

export class BaseDatastore implements Datastore {
  async open (): Promise<void> {

  }

  async close (): Promise<void> {

  }

  async put (key: Key, val: Uint8Array, options?: Options): Promise<void> {
    await Promise.reject(new Error('.put is not implemented'))
  }

  async get (key: Key, options?: Options): Promise<Uint8Array> {
    return await Promise.reject(new Error('.get is not implemented'))
  }

  async has (key: Key, options?: Options): Promise<boolean> {
    return await Promise.reject(new Error('.has is not implemented'))
  }

  async delete (key: Key, options?: Options): Promise<void> {
    await Promise.reject(new Error('.delete is not implemented'))
  }

  async * putMany (source: AwaitIterable<Pair>, options: Options = {}): AsyncIterable<Pair> {
    for await (const { key, value } of source) {
      await this.put(key, value, options)
      yield { key, value }
    }
  }

  async * getMany (source: AwaitIterable<Key>, options: Options = {}): AsyncIterable<Uint8Array> {
    for await (const key of source) {
      yield this.get(key, options)
    }
  }

  async * deleteMany (source: AwaitIterable<Key>, options: Options = {}): AsyncIterable<Key> {
    for await (const key of source) {
      await this.delete(key, options)
      yield key
    }
  }

  batch (): Batch {
    let puts: Pair[] = []
    let dels: Key[] = []

    return {
      put (key, value) {
        puts.push({ key, value })
      },

      delete (key) {
        dels.push(key)
      },
      commit: async (options) => {
        await drain(this.putMany(puts, options))
        puts = []
        await drain(this.deleteMany(dels, options))
        dels = []
      }
    }
  }

  /**
   * Extending classes should override `query` or implement this method
   */
  // eslint-disable-next-line require-yield
  async * _all (q: Query, options?: Options): AsyncIterable<Pair> {
    throw new Error('._all is not implemented')
  }

  /**
   * Extending classes should override `queryKeys` or implement this method
   */
  // eslint-disable-next-line require-yield
  async * _allKeys (q: KeyQuery, options?: Options): AsyncIterable<Key> {
    throw new Error('._allKeys is not implemented')
  }

  query (q: Query, options?: Options): AsyncIterable<Pair> {
    let it = this._all(q, options)

    if (q.prefix != null) {
      const prefix = q.prefix
      it = filter(it, (e) => e.key.toString().startsWith(prefix))
    }

    if (Array.isArray(q.filters)) {
      it = q.filters.reduce((it, f) => filter(it, f), it)
    }

    if (Array.isArray(q.orders)) {
      it = q.orders.reduce((it, f) => sort(it, f), it)
    }

    if (q.offset != null) {
      let i = 0
      const offset = q.offset
      it = filter(it, () => i++ >= offset)
    }

    if (q.limit != null) {
      it = take(it, q.limit)
    }

    return it
  }

  queryKeys (q: KeyQuery, options?: Options): AsyncIterable<Key> {
    let it = this._allKeys(q, options)

    if (q.prefix != null) {
      const prefix = q.prefix
      it = filter(it, (key) =>
        key.toString().startsWith(prefix)
      )
    }

    if (Array.isArray(q.filters)) {
      it = q.filters.reduce((it, f) => filter(it, f), it)
    }

    if (Array.isArray(q.orders)) {
      it = q.orders.reduce((it, f) => sort(it, f), it)
    }

    if (q.offset != null) {
      const offset = q.offset
      let i = 0
      it = filter(it, () => i++ >= offset)
    }

    if (q.limit != null) {
      it = take(it, q.limit)
    }

    return it
  }
}