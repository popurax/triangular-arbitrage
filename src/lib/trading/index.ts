import { BigNumber } from 'bignumber.js';
import * as ccxt from 'ccxt';
import * as types from '../type';
import { logger, Helper } from '../common';
import { Storage } from '../storage';
import { Mocker } from './mocker';
import { Order } from './order';
import { Daemon } from './daemon';
import { ITriangle } from '../type';

const clc = require('cli-color');
const config = require('config');

export class Trading {
  mocker: Mocker;
  order: Order;
  storage: Storage;
  daemon: Daemon;

  constructor() {
    this.mocker = new Mocker();
    this.storage = new Storage();
    this.order = new Order(this.storage);
    this.daemon = new Daemon(this.storage);
  }

  async testOrder(exchange: types.IExchange, triangle: types.ITriangle) : Promise<types.ITradeTriangle> | undefined{
    return await this.mocker.testOrder(exchange, triangle);
  }

  // 下单
  async placeOrder(exchange: types.IExchange, triangle: types.ITriangle) {
    try {
      const testTrade = await this.testOrder(exchange, triangle);
      // 未通过检查时返回
      if (!testTrade) {
        logger.error(`アービトラージの組み合わせは実現可能性テストに合格していません！ ！`);
        return;
      }

      if (config.trading.mock) {
        logger.error('モックモードで動いているので、実際に取引は行いません！！');
        return;
      }

      logger.info('----- 三角裁定を開始 -----');
      logger.info(`路径：${clc.cyanBright(triangle.id)} 利率: ${triangle.rate}`);
      // 清理超时数据
      // await this.storage.queue.clearQueue();
      const daemonCheck = await this.daemon.check(exchange);
      if (!daemonCheck) {
        logger.error('トランザクションセッションのエラーを処理してください！');
        return;
      }

      const limitCheck = await Helper.checkQueueLimit(this.storage.queue)
      if (!limitCheck) {
        logger.error('交易会话数已到限制数!!');
        return;
      }

      // 放入交易队列
      const queueId = await this.storage.openTradingSession({
        mock: testTrade,
        real: testTrade
      });
      if (!queueId) {
        return;
      }
      testTrade.queueId = queueId;
      logger.info("A点取引開始")
      await this.order.orderA(exchange, testTrade);
      await Helper.sleep(100);
      logger.info("B点取引開始")
      await this.order.orderB(exchange, testTrade);
      await Helper.sleep(100);
      logger.info("C点取引開始")
      await this.order.orderC(exchange, testTrade);
      await Helper.sleep(100);
      logger.info('----- 三角裁定を完了 -----');
    } catch (err) {
      logger.error(`处理订单出错： ${err.message ? err.message : err.msg} ${err.stack}`);
      // 退出交易队列
      // await this.storage.clearQueue(triangle.id, exchange.id);
    }
  }
}
