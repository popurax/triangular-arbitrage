import { Browser, launch, Page } from 'puppeteer';
import { BigNumber } from 'bigNumber.js';
import { ParsedUrlQuery } from 'querystring';
import { URL } from 'url';
import { setTimeout } from 'timers';

export type TopOrder = {
    sellOrder: {
        price: number,
        pairLeft: number,
        pairRight: number
    },
    buyOrder: {
        price: number,
        pairLeft: number,
        pairRight: number
    }
}

// シングルトン
export class scraping {

    private static browser;

    private static scraping: scraping;

    //XXX constructorはawaitが書けなかったので、クラスメソッドで回避。良さげな解決策があれば...
    public static async singleton(): Promise<scraping> {
        if (!this.scraping) {
            // let browser = await launch({ headless: false });
            let browser = await launch();
            this.scraping = new scraping(browser);  // constructorを呼ぶ。
        }
        return this.scraping;
    }

    // クラスメソッドから呼び出すのでprivate。
    private constructor(browser: Browser) {
        scraping.browser = browser;
    }

    //XXX ライブラリ使えばよかったのかもしれません。
    private parseURLFormat(str: string): URL {
        if (/http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- ./?%&=]*)?/.test(str.toString())) {
            return new URL(str);
        } else {
            throw new URIError("正しいURLではありません");
        }
    }

    // 今の所内部で使う予定なので、private。
    /**
     * 
     * @param url 
     * @returns quantity
     */
    private async fetchTopOrder(url: string): Promise<TopOrder> {

        const _url: URL = this.parseURLFormat(url);
        const pages = await scraping.browser.pages();

        var page: Page;
        //OPTIMIZE 既に同URLのタブがあるなら利用する。
        page = pages.filter(v => v.url() == _url.toString())[0];
        if (!page) {
            page = await scraping.browser.newPage();

            //OPTIMIZE 読み込み高速化設定。Webコピペ。さらに早く出来るアプローチがあれば、変更お願いします😣
            await page.setRequestInterception(true);
            const block_ressources = ['image', 'stylesheet', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'];
            page.on('request', request => {
                if (
                    block_ressources.indexOf(request.resourceType()) > 0
                    // Be careful with above
                    || String(request.url).includes('.jpg')
                    || String(request.url).includes('.jpeg')
                    || String(request.url).includes('.png')
                    || String(request.url).includes('.gif')
                    || String(request.url).includes('.css')
                )
                    request.abort();
                else
                    request.continue();
            });
            await page.goto(_url.toString());
        }
        const ticker:TopOrder = await page.evaluate(() => {
            return {
                sellOrder: {
                    price: document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(1)").textContent,
                    pairLeft: document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)").textContent,
                    pairRight: document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(3)").textContent,
                },
                buyOrder: {
                    price: document.querySelector("#buy-table > tbody > tr:nth-child(1) > td:nth-child(1)").textContent,
                    pairLeft: document.querySelector("#buy-table > tbody > tr:nth-child(1) > td:nth-child(2)").textContent,
                    pairRight: document.querySelector("#buy-table > tbody > tr:nth-child(1) > td:nth-child(3)").textContent
                }
            };
        }).catch(e => console.error("サイトから情報を取得できません。URLが間違っているかもしれません"));

        //XXX 閉じたり開いたりすると、アクセスが増えて、DoS攻撃と検知されアクセス制限されるかもしれないので、非推奨。
        // await page.close();
        return ticker;

    }

    public async fetchAskBidVolumes(...urls: string[]): Promise<TopOrder[]> {

        console.time("load")
        const promises = []
        urls.forEach(i => promises.push(this.fetchTopOrder(i))) // ここで非同期処理が始まっている。
        const askVolumes = await Promise.all(promises) // 非同期処理が全部終わるのを待機。

        console.timeEnd("load")
        return askVolumes;
    }
}


// example。Python界では慣習。
const main = (async () => {
    const scr = await scraping.singleton();
    const test1:TopOrder[] = await scr.fetchAskBidVolumes("https://www.coinexchange.io/market/DOGE/LTC",
        "https://www.coinexchange.io/market/LTC/BTC",
        "https://www.coinexchange.io/market/DOGE/BTC");
    console.log(test1.slice());
    await (async () => (new Promise(async r => await setTimeout(r, 2000))))();
    const test2:TopOrder[] = await scr.fetchAskBidVolumes("https://www.coinexchange.io/market/DOGE/LTC",
        "https://www.coinexchange.io/market/LTC/BTC",
        "https://www.coinexchange.io/market/DOGE/BTC");
    console.log(test2[0], test2[1]);
    await (async () => (new Promise(async r => await setTimeout(r, 2000))))();
    const test3:TopOrder[] = await scr.fetchAskBidVolumes("https://www.coinexchange.io/market/DOGE/LTC",
        "https://www.coinexchange.io/market/LTC/BTC",
        "https://www.coinexchange.io/market/DOGE/BTC");
    console.log(test3.slice());
    
    const sellbuy = ["sell","buy","sell"];
    const Aquantity = sellbuy[0] == 'buy' ? test3[0].sellOrder.pairLeft : test3[0].buyOrder.pairLeft
    const Bquantity = sellbuy[1] == 'buy' ? test3[1].sellOrder.pairLeft : test3[1].buyOrder.pairLeft
    const Cquantity = sellbuy[2] == 'buy' ? test3[2].sellOrder.pairLeft : test3[2].buyOrder.pairLeft
    

})

if (require.main === module) {
    main();
}

// /**
//  * Step 1 - Create pool using a factory object
//  */
// const factory = {
//     create: async function () {
//         return await puppeteer.launch();
//     },
//     destroy: async function (browser) {
//         await browser.close();
//     }
// };

// const opts = {
//     max: 10, // maximum size of the pool
//     min: 2 // minimum size of the pool
// };

// const myPool = poolCreator.createPool(factory, opts);

// /**
//  * Step 2 - Use pool in your code to acquire/release resources
//  */

// // acquire connection - Promise is resolved
// // once a resource becomes available
// const resourcePromise = myPool.acquire();

// resourcePromise
//     .then(async function (browser) {
//         const page=await browser.newPage();
//         await page.goto("https://google.com");
//     })
//     .catch(function (err) {
//         console.error(`リソースの取得に失敗しました。:${err}`);
//         // handle error - this is generally a timeout or maxWaitingClients
//         // error
//     });

// /**
//  * Step 3 - Drain pool during shutdown (optional)
//  */
// // Only call this once in your application -- at the point you want
// // to shutdown and stop using this pool.
// myPool.drain().then(()=>myPool.destroy());

// const puppeteerPoolFactory = require('puppeteer-pool');

// const pool = puppeteerPoolFactory();


// (async () => {

//     var url = 'https://www.coinexchange.io/market/DOGE/LTC';

//     await pool.use(async (browser) => {
//         const page = await browser.newPage();
//         await page.goto(url);
//         var quantity = await page.evaluate(() => {
//             const node = document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)");
//             return node.textContent;
//         });
//         page.close();
//         return quantity;
//     }).then((v) => console.log(v));

//     await pool.drain().then(function() {
//         pool.clear();
//       });

// })();


// const edge2 = (async () => {
//     pool.use(async (browser) => {
//         const page = await browser.newPage();
//         await page.goto('https://www.coinexchange.io/market/DOGE/LTC');
//         var quantity = await page.evaluate(() => {
//             const node = document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)");
//             return node.textContent;
//         });
//         return quantity;
//     })
// });

// const edge3 = (async () => {
//     pool.use(async (browser) => {
//         const page = await browser.newPage();
//         await page.goto('https://www.coinexchange.io/market/DOGE/BTC');
//         var quantity = await page.evaluate(() => {
//             const node = document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)");
//             return node.textContent;
//         });
//         return quantity;
//     })
// });



// (async () => {
//     const browser = await puppeteer.launch();

//     const edge1 = (async () => {
//         const page = await browser.newPage();
//         await page.goto('https://www.coinexchange.io/market/LTC/BTC');
//         var quantity = await page.evaluate(() => {
//             const node = document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)");
//             return node.textContent;
//         });
//         return quantity;
//     });

//     const edge2 = (async () => {
//         const page = await browser.newPage();
//         await page.goto('https://www.coinexchange.io/market/DOGE/LTC');
//         var quantity = await page.evaluate(() => {
//             const node = document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)");
//             return node.textContent;
//         });
//         return quantity;
//     });

//     const edge3 = (async () => {
//         const page = await browser.newPage();
//         await page.goto('https://www.coinexchange.io/market/DOGE/BTC');
//         var quantity = await page.evaluate(() => {
//             const node = document.querySelector("#sell-table > tbody > tr:nth-child(1) > td:nth-child(2)");
//             return node.textContent;
//         });
//         return quantity;
//     });

//     const [r1,r2,r3] = [await edge1(), await edge2(), await edge3()];
//     console.log(r1, r2, r3);

//     browser.close();
// })();
// const osmosis = require('osmosis');
// osmosis.get('https://www.coinexchange.io/market/LTC/BTC')
// .set({
//     v: '#sell-table'
// })
// .test3(v => console.log(v))
// .log(console.log)
