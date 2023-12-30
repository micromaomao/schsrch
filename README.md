# SchSrch

![demo video](readme_video.gif)

[![Dependencies](https://david-dm.org/micromaomao/schsrch.svg)](https://david-dm.org/micromaomao/schsrch)
[![devDependencies Status](https://david-dm.org/micromaomao/schsrch/dev-status.svg)](https://david-dm.org/micromaomao/schsrch?type=dev)
[![Known Vulnerabilities](https://snyk.io/test/github/micromaomao/schsrch/badge.svg)](https://snyk.io/test/github/micromaomao/schsrch)
[![MIT Licence](https://badges.frapsoft.com/os/mit/mit.svg?v=103)](https://opensource.org/licenses/mit-license.php)

---

## Ready-to-run docker image

[![](https://images.microbadger.com/badges/image/ghcr.io/micromaomao/schsrch.svg) ghcr.io/micromaomao/schsrch](ghcr.io/micromaomao/schsrch)

Environment variables needed: (i.e. docker run -e xxx=xxx -e&hellip; maowtm/schsrch)

- MONGODB=mongodb://*&lt;your-mongo-server&gt;*/schsrch
- ES=*&lt;your-elasticsearch-server&gt;*:9200
- SITE\_ORIGIN=http://localhost (depend on you)

For a possible developmental set-up, see [./docker-compose-example.yml](./docker-compose-example.yml) .

----

<a href="https://www.browserstack.com/"><img alt="BrowserStack logo" src="https://bstacksupport.zendesk.com/attachments/token/bueUNYiYxIt9MAgcZtTTLFS59/?name=Logo-01.svg" width="270"></a>

BrowserStack supported this project by offering me free access to a variety of real iPhone / Mac devices for testing, which I couldn't have afford otherwise. Big thanks goes to them. Their platform
allows you to test your website remotely with real devices running Android, iOS, Windows, OS X and even Windows Phone, just in your browser. There is a 30 minute trial for new users. I would recommend
using that to see if your website runs nicely on all platforms.
