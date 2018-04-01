import { Market as IMarket } from 'ccxt';

export { IMarket };

export interface ISupportExchange {
  id: string;
  name: string;
}

export interface IExchange {
  id: ExchangeId;
  endpoint: {
    public?: any;
    private?: any;
    ws?: any;
    rest?: any;
  };
  markets?: IMarkets;
  pairs?: IPairs;
}

export interface IMarkets {
  [baseCoin: string]: IMarket[];
}

export interface IPairs {
  [pair: string]: IMarket;
}

// default.tomlのaccountに別名を付けられるようにするだけだし、要らないだろ。
export enum ExchangeId {
  KuCoin = 'kucoin',
  Binance = 'binance',
  Bitbank = 'bitbank',
  Yobit = 'yobit',
  Livecoin = 'livecoin',
  Bleutrade = 'bleutrade',
  Coinexchange = 'coinexchange'
}

export const SupportExchanges = [
  {
    id: ExchangeId.KuCoin,
    name: '库币',
  },
  {
    id: ExchangeId.Binance,
    name: '币安',
  },
  {
    id: ExchangeId.Bitbank,
    name: 'Bitbank',
  },
  {
    id: ExchangeId.Yobit,
    name: 'Yobit',
  },
  {
    id: ExchangeId.Livecoin,
    name: 'Livecoin',
  },
  {
    id: ExchangeId.Bleutrade,
    name: 'Bleutrade'
  },
  {
    id: ExchangeId.Coinexchange,
    name: 'Coinexchange'
  }
];

export interface ICredentials {
  apiKey: string;
  secret: string;
}
