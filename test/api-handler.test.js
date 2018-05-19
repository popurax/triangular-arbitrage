import { Helper } from '../src/lib/common';
import * as types from '../src/lib/type';
import { ApiHandler } from '../src/lib/api-handler';
const testCreateOrder = async();
{
    const exId = types.ExchangeId.Yobit;
    const exchange = Helper.getExchange(types.ExchangeId.Yobit);
    const api = new ApiHandler();
    const order = {
        symbol: 'ETH/BTC',
        amount: 0.014,
        price: 0.077845,
        type: 'limit',
        side: 'buy',
    };
    const res = await, api, createOrder = (exchange, order);
    console.log(res);
}
;
const testQueryOrder = async();
{
    const exId = types.ExchangeId.Yobit;
    const exchange = Helper.getExchange(types.ExchangeId.Yobit);
    const api = new ApiHandler();
    const res = await, api, queryOrder = (exchange, '98162639', 'ETH/BTC');
    console.log(res);
}
;
const testQueryOrderStatus = async();
{
    const exId = types.ExchangeId.Yobit;
    const exchange = Helper.getExchange(types.ExchangeId.Yobit);
    const api = new ApiHandler();
    const res = await, api, queryOrderStatus = (exchange, '98162639', 'ETH/BTC');
    console.log(res);
}
;
describe('API测试', () => {
    // it('测试下单', testCreateOrder);
    // it('测试订单查询', testQueryOrder);
    it('测试订单状态查询', testQueryOrderStatus);
});
