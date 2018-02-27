
const http = require('http')
const https = require('https')

const express = require('express')
// 引入 url 模块, 方便解析 url
const url = require('url')
const bodyParser = require('body-parser')
const nunjucks = require('nunjucks')

const app = express()

// 这样配置 bodyParser 之后, 就可以拿到请求中的 json 数据了
app.use(bodyParser.json())
// 配置静态资源文件, 比如 js css 图片
const asset = __dirname + '/static'
app.use('/static', express.static(asset))

// 配置 nunjucks 模板, 第一个参数是模板文件的路径
nunjucks.configure('templates', {
    autoescape: true,
    express: app,
    noCache: true,
})

const log = console.log.bind(console)

const clientByProtocol = (protocol) => {
    if (protocol === 'http:') {
        return http
    } else {
        return https
    }
}

// 配置基本的请求参数
const apiOptions = () => {
    // 从环境变量里获取 apiServer 的值, 尽管这个做法不太好
    // (因为环境变量里的值相当于全局变量, 而且是无法控制的全局变量)
    const envServer = process.env.apiServer
    console.log('envSever', envServer)
    // 设置默认 api 服务器地址
    const defaultServer = 'http://127.0.0.1:4000'
    const server = envServer || defaultServer
    // 解析 url 之后的结果
    const result = url.parse(server)
    console.log('result',server, result)
    const obj = {
        headers: {
            'Content-Type': 'application/json',
        },
        // https 相关的设置, 为了方便直接设置为 false 就可以了
        rejectUnauthorized: false,
    }
    const options = Object.assign({}, obj, result)

    if (options.href.length > 0) {
        delete options.href
    }
    console.log('options', options)
    return options
}

// 配置 api 请求参数
const httpOptions = (request) => {
    // 先获取基本的 api options 设置
    const baseOptions = apiOptions()
    // 设置请求的 path
    const pathOptions = {
        path: request.originalUrl,
    }
    const options = Object.assign({}, baseOptions, pathOptions)
    Object.keys(request.headers).forEach((k) => {
        options.headers[k] = request.headers[k]
    })
    // 设置请求的方法
    options.method = request.method
    return options
}

app.get('/', (request, response) => {
    response.render('index.html')
})

app.all('/api/*', (request, response) => {
    const options = httpOptions(request)
    log('request options', options)
    const client = clientByProtocol(options.protocol)
    // HTTP 请求原始信息
    // http.request 会把数据发送到 api server
    // http.request 也会返回一个请求对象
    const r = client.request(options, (res) => {
        response.status(res.statusCode)
        log('debug res', res.headers, res.statusCode)
        Object.keys(res.headers).forEach((k) => {
            const v = res.headers[k]
            response.setHeader(k, v)
        })

        // 接收 api server 的响应时, 会触发 data 事件, 作业 2 中用到过这个知识
        res.on('data', (data) => {
            console.log('debug data', data.toString('utf8'))
            response.write(data)
        })

        // api server 的数据接收完成后, 会触发 end 事件
        res.on('end', () => {
            log('debug end')
            // api server 发送完数据之后, express 也告诉客户端发送完数据
            response.end()
        })

        // 响应发送错误
        res.on('error', () => {
            console.error(`error to request: ${request.url}`)
        })
    })

    // 发往 api server 的请求遇到问题
    r.on('error', (error) => {
        console.error(`请求 api server 遇到问题: ${request.url}`, error)
    })

    log('debug options method', options.method)
    if (options.method !== 'GET') {
        const body = JSON.stringify(request.body)
        log('debug body', body, typeof body)
        // 把 body 里的数据发送到 api server
        r.write(body)
    }
    r.end()
})

// 把逻辑放在单独的函数中, 这样可以方便地调用
// 指定了默认的 host 和 port, 因为用的是默认参数, 当然可以在调用的时候传其他的值
const run = (port=3000, host='') => {
    const server = app.listen(port, host, () => {
        // 非常熟悉的方法
        const address = server.address()
        host = address.address
        port = address.port
        log(`server started at http://${host}:${port}`)
    })
}

if (require.main === module) {
    const port = 3300
    // host 参数指定为 '0.0.0.0' 可以让别的机器访问你的代码
    const host = '0.0.0.0'
    run(port, host)
}
