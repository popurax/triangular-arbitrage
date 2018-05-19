import { BigNumber } from 'bignumber.js';
import { logger, Helper } from './common';
import { Event } from './event';
import { Engine, isIEdgeCoinexchange } from './engine';
import { Aggregator } from './aggregator';
import * as types from './type';
import { Storage } from './storage';
import { ITriangle, IEdgeCoinexchange, IEdge } from './type';
import {on, emit} from 'event-emitter';
import * as reader from 'readline';

const clc = require('cli-color');
const config = require('config');

export class TriangularArbitrage extends Event {
  exchanges: Map<string, types.IExchange> = new Map();
  activeExchangeId: types.ExchangeId;
  // 机器人id
  worker = 0;
  // 匹配引擎
  engine: Engine;
  // 集计数据提供
  aggregator: Aggregator;
  // this.index number
  index: number;

  constructor() {
    super();
    this.activeExchangeId = <types.ExchangeId>config.exchange.active;
    this.engine = new Engine();
    this.aggregator = new Aggregator();
    this.index = 0;
  }

  async start(activeExchangeId?: types.ExchangeId) {
    const timer = Helper.getTimer();
    logger.debug('启动三角套利机器人[开始]');
    if (activeExchangeId) {
      this.activeExchangeId = activeExchangeId;
    }

    try {
      // 初始化交易所
      await this.initExchange(this.activeExchangeId);
      if (types.ExchangeId.Binance === this.activeExchangeId) {
        const exchange = this.exchanges.get(this.activeExchangeId);
        if (!exchange) {
          return;
        }
        exchange.endpoint.ws.onAllTickers(this.estimate.bind(this));
      } else {
        this.worker = await setInterval(this.estimate.bind(this), config.arbitrage.interval * 1000);
      }

      logger.info('----- 机器人启动完成 -----');
    } catch (err) {
      logger.error(`机器人运行出错(${Helper.endTimer(timer)}): ${err}`);
    }
    logger.debug(`启动三角套利机器人[终了] ${Helper.endTimer(timer)}`);
  }

  destroy() {
    if (this.worker) {
      clearInterval(this.worker);
    }
  }

  public async initExchange(exchangeId: types.ExchangeId) {
    const timer = Helper.getTimer();
    logger.debug('初始化交易所[启动]');
    try {
      // 查看是否已初始化api
      if (this.exchanges.get(exchangeId)) {
        logger.debug('dont exchange get');
        return;
      }

      const exchange = Helper.getExchange(exchangeId);
      if (!exchange) {
        logger.debug('dont helper get');
        return;
      }
      const api = exchange.endpoint.public || exchange.endpoint.private;
      if (api) {
        exchange.pairs = await this.aggregator.getMarkets(exchange);
        if (!exchange.pairs) {
          return;
        }
        const markets: {[coin: string]: types.IMarket[];} = {};
        const baseCoins = Helper.getMarketCoins(Object.keys(exchange.pairs));
        for (const baseCoin of baseCoins) {
          if (!markets[baseCoin]) {
            markets[baseCoin] = [];
          }
          const pairKeys = Object.keys(exchange.pairs).filter((pair: string) => pair.includes(baseCoin));
          for (const key of pairKeys) {
            markets[baseCoin].push(exchange.pairs[key]);
          }
          exchange.markets = markets;
        }
      }
      this.exchanges.set(exchangeId, exchange);
      logger.debug(`初始化交易所[终了] ${Helper.endTimer(timer)}`);
    } catch (err) {
      logger.error(`初始化交易所[异常](${Helper.endTimer(timer)}): ${err}`);
    }
  }

  // 套利测算
  async estimate(tickers?: types.Binance24HrTicker[]) {
    const timer = Helper.getTimer();
    logger.debug('监视行情[开始]');
    try {
      logger.info(clc.magentaBright('----- 套利测算 -----'));
      const exchange = this.exchanges.get(this.activeExchangeId);
      if (!exchange) {
        logger.debug('no exchange');
        return;
      }
      // 清理超时数据
      // const limitCheck = await Helper.checkQueueLimit(this.storage.queue)
      //  if (!limitCheck) {
      //    logger.error('取引セッションの数が限界に達しました！');
      //    await this.storage.queue.clearQueue()
      //    return;
      //  }
      const allTickers = await this.aggregator.getAllTickers(exchange, tickers);
      if (!allTickers) {
        logger.error('no tickers');
        return;
      }
      // 匹配候选者
      var candidates: types.ITriangle[] = await this.engine.getCandidates(exchange, allTickers);
      if (!candidates || candidates.length === 0) {
        logger.error('no candidates');
        return;
      }

      const ranks = Helper.getRanks(exchange.id, candidates);
      if (config.storage.tickRank && ranks.length > 0) {
        // 更新套利数据
        this.emit('updateArbitage', ranks);
      }

      // if (isIEdgeCoinexchange(candidates[0].a)) {
      //   let cx_candidates: any = [];

      //   candidates.forEach(triangle => {
      //     cx_candidates.push({
      //       a: triangle.a as types.IEdgeCoinexchange,
      //       b: triangle.b as types.IEdgeCoinexchange,
      //       c: triangle.c as types.IEdgeCoinexchange,
      //       id: triangle.id,
      //       rate: triangle.rate,
      //       ts: triangle.ts
      //     });
      //   });

      //   candidates = cx_candidates.slice(0,5).sort((a,b)=> b.c.tradeCount - a.c.tradeCount );
      // }

      
      var stdin = process.openStdin();
      stdin.addListener('data',(d)=>{
        this.index = d.toString().trim();
      })
      console.log(this.index);
      // const reader = require('readline')
      // reader.on('line', function (i) {
      //   this.index = i;
      // });
      // reader.on('close', function () {
      //     //any
      // });

      // 更新套利数据
      if (ranks[0]) {
        // candidates.slice(5,6).forEach((candidate, i) => {
        logger.info(`选出套利组合第一名：${candidates[this.index].id}, 预测利率(扣除手续费): ${ranks[0].profitRate[this.index]}`);
        // 执行三角套利


        this.emit('placeOrder', exchange, candidates[this.index]);

        const output = candidates.length > 5 ? candidates.slice(0, 5) : candidates.slice(0, candidates.length);
        for (const candidate of output) {
          const clcRate = candidate.rate < 0 ? clc.redBright(candidate.rate) : clc.greenBright(candidate.rate);
          const path = candidate.id.length < 15 ? candidate.id + ' '.repeat(15 - candidate.id.length) : candidate.id;
          logger.info(`${clc.cyanBright(path)} rate:${clcRate}`);
        }
        // })
      }
      logger.debug(`监视行情[终了] ${Helper.endTimer(timer)}`);
    } catch (err) {
      logger.error(`监视行情[异常](${Helper.endTimer(timer)}): ${JSON.stringify(err)}`);
    }
  }
}
