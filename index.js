const fs = require('fs/promises')
const fso = require('fs');
const pup = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require('puppeteer')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
pup.use(StealthPlugin());
pup.use(
    AdblockerPlugin({
        interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY
    })
)

if (process.argv[2] && process.argv[3])
    start(process.argv[2], process.argv[3]);
else
    start();

async function start(user = null, pass = null) {
    const browser = await pup.launch(/*{headless: false}*/);
    const page = await browser.newPage();
    await page.setUserAgent('Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36');

    if (fso.existsSync('cookies.json'))
        try {
            await loadCookie(page);
            await page.goto('https://shopee.tw/shopee-coins', { waitUntil: 'networkidle0' });
        } catch (e) { console.log(e) }
    else 
        await login(browser,page,user,pass);

    await page.waitForSelector("button[class^='pcmall-dailycheckin']");
    let bText = await (await page.$("button[class^='pcmall-dailycheckin']")).evaluate(b => b.textContent);
    console.log(bText);
    if(bText.includes('快來登入'))
    {
        await login(browser,page,user,pass);
        await page.waitForSelector("button[class^='pcmall-dailycheckin']");
        await saveCookie(page);
        bText = await (await page.$("button[class^='pcmall-dailycheckin']")).evaluate(b => b.textContent);
        console.log(bText);
    }
    await saveCookie(page);
    if(bText.includes('明天'))
    {
        await page.screenshot({ path: "result.png", fullPage: true });
        await browser.close();
        return;
    }
    if(!bText.includes('完成簽到'))
    {
        await page.screenshot({ path: "error.png", fullPage: true });
        await browser.close();
        throw "Something went wrong";
    }
    page.click("button[class^='pcmall-dailycheckin']");
    console.log('✔ check in -n- got coin');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "result.png", fullPage: true });
    await browser.close();
    return;
}

//Login
const login = async (browser,page,user,pass) =>{
    if (user != null && pass != null) {
        console.log("NO COOKIES - login")
        try {
            await page.goto("https://shopee.tw/buyer/login?next=https%3A%2F%2Fshopee.tw%2Fshopee-coins", { waitUntil: 'networkidle2' });
            await page.type('[name=loginKey]', user);
            await page.type('[name=password]', pass);
            const xpath = "//button[contains(text(),'登入')]";
            await page.waitForXPath(xpath + "[not(@disabled)]");
            await page.waitForTimeout(500)
            const button = await page.$x(xpath);
            await Promise.all([
                button[0].click(),
                page.waitForNavigation({
                    waitUntil: 'networkidle0',
                }),
            ]);
            await page.waitForTimeout(5000)
            console.log(page.url());
            if (!page.url().includes('https://shopee.tw/shopee-coins')) {
                const sms = "//div[contains(string(),'使用連結驗證')]";
                await page.waitForXPath(sms).then(async () => {
                    console.log("SMS login");
                    const divs = await page.$x(sms);
                    await divs.pop().click();
                    for (let i = 0; i < 60; i++) {
                        console.log("waiting for sms link (5 sec) ..." + (i + 1) + "/60");
                        await page.waitForTimeout(5000);
                        console.log(page.url());
                        if (page.url() != 'https://shopee.tw/verify/link') return;
                        else if ((i + 1) == 60) {
                            console.log("SMS link not clicked, can't login");
                            throw "Couldn't Log-in";
                            await browser.close();
                            return;
                        }
                    }
                });
            }
        } catch (error) {
            if (error.name === "TimeoutError") {
                console.log(error.name + ": some kind of error, check error.png")
                await page.screenshot({ path: "error.png", fullPage: true })
            } else {
                console.log(error)
                await page.screenshot({ path: "error.png", fullPage: true })
            }
            await browser.close();
            return;
        }
    }
    else {
        console.log("no cookies and no credential, can't do anything");
        await browser.close();
        return;
    }
}

//save cookie function
const saveCookie = async (page) => {
    console.log("Saving cookies");
    const cookies = await page.cookies();
    const cookieJson = JSON.stringify(cookies, null, 2);
    await fs.writeFile('cookies.json', cookieJson);
    console.log("Cookies saved");
}

//load cookie function
const loadCookie = async (page) => {
    const cookieJson = await fs.readFile('cookies.json');
    const cookies = JSON.parse(cookieJson);
    await page.setCookie(...cookies);
    console.log("Cookies loaded");
}
