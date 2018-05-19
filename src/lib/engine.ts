import * as types from './type';
import { logger, Helper } from './common';
import { IExchange, IEdge } from './type';
import { coinexchange } from 'ccxt';

import Optional from 'typescript-optional';

const config = require('config');

// TODO Helperクラスに移動するべきか?
export function isIEdgeCoinexchange(edge: types.IEdge | types.IEdgeCoinexchange): edge is types.IEdgeCoinexchange {
  return config.exchange.active == "coinexchange" ;
}

export class Engine {
  
  // 获取组合的边
  getEdge(tickers: types.ITickers, coinFrom: string, coinTo: string): types.IEdge | types.IEdgeCoinexchange | undefined {

    if ((!tickers && Object.keys(tickers).length === 0) || !coinFrom || !coinTo) {
      return;
    }
    
    
    // 查找匹配的ticker
    
    const buyTicker = tickers[coinTo + '/' + coinFrom];

    const edge = <types.IEdge | types.IEdgeCoinexchange>{ coinFrom, coinTo };
    if (buyTicker && buyTicker.ask !== 0) {
      edge.pair = buyTicker.symbol;
      edge.side = 'buy';
      edge.price = buyTicker.ask;
      edge.quantity = buyTicker.askVolume;
      if(isIEdgeCoinexchange(edge)){
        edge.tradeCount = buyTicker.info['TradeCount'];
      }
    } else {
      // 查找匹配的ticker
      const sellTicker = tickers[coinFrom + '/' + coinTo];
      if (!sellTicker) {
        return;
      }
      edge.pair = sellTicker.symbol;
      edge.side = 'sell';
      edge.price = sellTicker.bid;
      edge.quantity = sellTicker.bidVolume;
      if(isIEdgeCoinexchange(edge)){
        edge.tradeCount = sellTicker.info['TradeCount'];
      }
    }
    return edge;
  }

  // 获取三角套利信息
  private getTriangle(tickers: types.ITickers, abc: { a: string; b: string; c: string }) {
    if ((!tickers && Object.keys(tickers).length === 0) || !abc || !abc.a || !abc.b || !abc.c) {
      return;
    }
    const a = this.getEdge(tickers, abc.a, abc.b);
    const b = this.getEdge(tickers, abc.b, abc.c);
    const c = this.getEdge(tickers, abc.c, abc.a);
    if (!a || !b || !c) {
      return;
    }
    const rate = Helper.getTriangleRate(a, b, c);
    return <types.ITriangle>{
      id: a.coinFrom + '-' + b.coinFrom + '-' + c.coinFrom,
      a,
      b,
      c,
      rate,
      ts: Date.now(),
    };
  }

  private findCandidates(exchange: types.IExchange, tickers: types.ITickers, aCoinfrom: string, aCoinTo: string): types.ITriangle[] | undefined {

    /*
      通过BPair配对
    */
    const triangles: types.ITriangle[] = [];

    if (!exchange.markets) {
      logger.error(`findCandidates: marketsがありません!!`);
      return;
    }
    const abc = {
      a: aCoinfrom.toUpperCase(),
      b: aCoinTo.toUpperCase(),
      c: 'findme'.toUpperCase(),
    };

    const aPairs = exchange.markets[abc.a];
    const bPairs = exchange.markets[abc.b];

    if (!aPairs || !bPairs) {
      logger.error(`findCandidates: aPairsかbPairsがありません!!`)
      return triangles;
    }

    // 去掉b点coin
    const aCoinToSet: { [coin: string]: types.IMarket } = {};
    aPairs.map((market: types.IMarket) => {
      aCoinToSet[market.base] = market;
    });
    delete aCoinToSet[abc.b];

    for (let i = 0; i < bPairs.length; i++) {
      const bPairMarket = bPairs[i];

      if (aCoinToSet[bPairMarket.base]) {
        const stepC = this.getEdge(tickers, bPairMarket.base, abc.a);

        // 匹配到路径C
        if (stepC) {
          abc.c = stepC.coinFrom;

          const triangle = this.getTriangle(tickers, abc);
          if (!triangle) {
            continue;
          }

          triangles.push(triangle);
        }
      }
    }
    return triangles;
  }

  async getCandidates(exchange: types.IExchange, tickers: types.ITickers): Promise<types.ITriangle[]> {
    let candidates: types.ITriangle[] = [];
    if (!exchange.markets) {
      logger.error(`getCandidates: exchange.marketsがありません!!`)
      return;
    }
    const marketPairs = Object.keys(exchange.markets);
    const api = exchange.endpoint.public || exchange.endpoint.private;
    if (!api || marketPairs.length === 0) {
      logger.error(`getCandidates: apiが無いか、marketPairs.lengthが0です!!`)
      return;
    }
    const timer = Helper.getTimer();
    logger.debug('getCandidates:获取全市场候选者[开始]');
    for (const [index, marketPair] of marketPairs.entries()) {
      const paths = marketPairs.slice(0);
      // 删除起始路径
      paths.splice(index, 1);

      for (const path of paths) {
        const foundCandidates = this.findCandidates(exchange, tickers, marketPair, path);
        // [object Object],[object Object]
        logger.debug(foundCandidates + "");
        if (foundCandidates && foundCandidates.length > 0) {
          candidates = candidates.concat(foundCandidates);
        }
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => {
        return b.rate - a.rate;
      });
    }

    // 淘汰落选者
    if (candidates.length > config.display.maxRows) {
      candidates = candidates.slice(0, config.display.maxRows);
    }

    logger.debug(`getCandidates:获取全市场候选者[终了] ${Helper.endTimer(timer)}`);
    return candidates;
  }
}
