import { EventEmitter } from 'events';
import { Trading } from './trading';
import * as types from './type';
import { logger, Helper } from './common';

/**
 * 通用事件处理器
 */
export class Event extends EventEmitter {
  trading: Trading;

  constructor() {
    super();
    this.trading = new Trading();
    this.on('placeOrder', this.onPlaceOrder);
    this.on('updateArbitage', this.onUpdateArbitage);
  }

  async onPlaceOrder(exchange: types.IExchange, triangle: types.ITriangle) {
    const timer = Helper.getTimer();
    logger.debug('取引実行イベント[開始]');
    logger.info('取引実行');
    await this.trading.placeOrder(exchange, triangle);
    // await this.trading.testOrder(exchange, triangle);
    logger.debug(`取引実行イベント[終了] ${Helper.endTimer(timer)}`);
  }

  async onUpdateArbitage(ranks: types.IRank[]) {
    if (ranks.length > 0) {
      await this.trading.storage.rank.putRanks(ranks);
    }
  }
}
