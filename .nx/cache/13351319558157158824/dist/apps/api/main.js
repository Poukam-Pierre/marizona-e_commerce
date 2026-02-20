/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),
/* 3 */
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("@nestjs/swagger");

/***/ }),
/* 5 */
/***/ ((module) => {

module.exports = require("@nestjs/config");

/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("helmet");

/***/ }),
/* 7 */
/***/ ((module) => {

module.exports = require("compression");

/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(5);
const throttler_1 = __webpack_require__(9);
const core_1 = __webpack_require__(3);
// Common
const common_module_1 = __webpack_require__(10);
const http_exception_filter_1 = __webpack_require__(15);
const transform_interceptor_1 = __webpack_require__(16);
const logging_middleware_1 = __webpack_require__(18);
// Modules
const auth_module_1 = __webpack_require__(19);
const users_module_1 = __webpack_require__(36);
const products_module_1 = __webpack_require__(42);
const categories_module_1 = __webpack_require__(48);
const orders_module_1 = __webpack_require__(53);
const inventory_module_1 = __webpack_require__(59);
const notifications_module_1 = __webpack_require__(63);
// Config
const config_2 = __webpack_require__(66);
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(logging_middleware_1.LoggingMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            // Configuration
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [config_2.appConfig, config_2.jwtConfig, config_2.redisConfig, config_2.databaseConfig],
                envFilePath: ['.env', '../../.env'],
            }),
            // Common (Global providers)
            common_module_1.CommonModule,
            // Rate limiting
            throttler_1.ThrottlerModule.forRoot([
                {
                    name: 'short',
                    ttl: 1000, // 1 second
                    limit: 3, // 3 requests per second
                },
                {
                    name: 'medium',
                    ttl: 10000, // 10 seconds
                    limit: 20, // 20 requests per 10 seconds
                },
                {
                    name: 'long',
                    ttl: 60000, // 1 minute
                    limit: 100, // 100 requests per minute
                },
            ]),
            // Feature modules
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            products_module_1.ProductsModule,
            categories_module_1.CategoriesModule,
            orders_module_1.OrdersModule,
            inventory_module_1.InventoryModule,
            notifications_module_1.NotificationsModule,
        ],
        providers: [
            // Global exception filter
            {
                provide: core_1.APP_FILTER,
                useClass: http_exception_filter_1.HttpExceptionFilter,
            },
            // Global response transformer
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: transform_interceptor_1.TransformInterceptor,
            },
        ],
    })
], AppModule);


/***/ }),
/* 9 */
/***/ ((module) => {

module.exports = require("@nestjs/throttler");

/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CommonModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
const redis_service_1 = __webpack_require__(13);
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = tslib_1.__decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [prisma_service_1.PrismaService, redis_service_1.RedisService],
        exports: [prisma_service_1.PrismaService, redis_service_1.RedisService],
    })
], CommonModule);


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var PrismaService_1;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PrismaService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const client_1 = __webpack_require__(12);
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super({
            log: [
                { level: 'error', emit: 'stdout' },
                { level: 'warn', emit: 'stdout' },
            ],
        });
        this.logger = new common_1.Logger(PrismaService_1.name);
    }
    async onModuleInit() {
        await this.$connect();
        this.logger.log('✅ Database connected successfully');
    }
    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log('Database disconnected');
    }
    /**
     * Execute a transaction with automatic retry on conflict
     */
    async executeTransaction(fn, maxRetries = 3) {
        let lastError = null;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await this.$transaction(fn);
            }
            catch (error) {
                if (error.code === 'P2034') {
                    lastError = error;
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [])
], PrismaService);


/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var RedisService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RedisService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const config_1 = __webpack_require__(5);
const ioredis_1 = tslib_1.__importDefault(__webpack_require__(14));
let RedisService = RedisService_1 = class RedisService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RedisService_1.name);
        this.client = null;
        this.isConnected = false;
    }
    async onModuleInit() {
        const redisUrl = this.configService?.get('redis.url');
        if (!redisUrl) {
            this.logger.warn('Redis URL not configured. Caching will be disabled.');
            return;
        }
        try {
            this.client = new ioredis_1.default(redisUrl, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            });
            this.client.on('connect', () => {
                this.isConnected = true;
                this.logger.log('✅ Redis connected successfully');
            });
            this.client.on('error', (error) => {
                this.logger.error(`Redis error: ${error.message}`);
                this.isConnected = false;
            });
            this.client.on('close', () => {
                this.logger.warn('Redis connection closed');
                this.isConnected = false;
            });
            await this.client.connect();
        }
        catch (error) {
            this.logger.warn(`Failed to connect to Redis: ${error.message}. Caching will be disabled.`);
        }
    }
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.logger.log('Redis connection closed');
        }
    }
    /**
     * Check if Redis is available
     */
    isAvailable() {
        return this.isConnected && this.client !== null;
    }
    /**
     * Get a value from cache
     */
    async get(key) {
        if (!this.isAvailable())
            return null;
        try {
            const data = await this.client.get(key);
            if (!data)
                return null;
            return JSON.parse(data);
        }
        catch (error) {
            this.logger.error(`Redis GET error for key ${key}: ${error.message}`);
            return null;
        }
    }
    /**
     * Set a value in cache
     */
    async set(key, value, ttl) {
        if (!this.isAvailable())
            return;
        try {
            const data = JSON.stringify(value);
            if (ttl) {
                await this.client.setex(key, ttl, data);
            }
            else {
                await this.client.set(key, data);
            }
        }
        catch (error) {
            this.logger.error(`Redis SET error for key ${key}: ${error.message}`);
        }
    }
    /**
     * Delete a key from cache
     */
    async del(key) {
        if (!this.isAvailable())
            return;
        try {
            await this.client.del(key);
        }
        catch (error) {
            this.logger.error(`Redis DEL error for key ${key}: ${error.message}`);
        }
    }
    /**
     * Delete multiple keys matching a pattern
     */
    async delPattern(pattern) {
        if (!this.isAvailable())
            return;
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        }
        catch (error) {
            this.logger.error(`Redis DEL PATTERN error for pattern ${pattern}: ${error.message}`);
        }
    }
    /**
     * Get or set a value with a callback
     */
    async getOrSet(key, callback, ttl = 300) {
        // If Redis is not available, just call the callback
        if (!this.isAvailable()) {
            return callback();
        }
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await callback();
        await this.set(key, value, ttl);
        return value;
    }
    /**
     * Increment rate limit counter
     */
    async incrementRateLimit(key, ttl) {
        if (!this.isAvailable()) {
            return { count: 0, remaining: Infinity };
        }
        try {
            const count = await this.client.incr(key);
            if (count === 1) {
                await this.client.expire(key, ttl);
            }
            const ttlRemaining = await this.client.ttl(key);
            return { count, remaining: ttlRemaining };
        }
        catch (error) {
            this.logger.error(`Redis rate limit error for key ${key}: ${error.message}`);
            return { count: 0, remaining: Infinity };
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        if (!this.isAvailable()) {
            return { status: 'disconnected' };
        }
        try {
            const start = Date.now();
            await this.client.ping();
            return { status: 'healthy', latency: Date.now() - start };
        }
        catch {
            return { status: 'unhealthy' };
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__param(0, (0, common_1.Optional)()),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object])
], RedisService);


/***/ }),
/* 14 */
/***/ ((module) => {

module.exports = require("ioredis");

/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HttpExceptionFilter = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const client_1 = __webpack_require__(12);
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(HttpExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let error = 'Internal Server Error';
        let details = undefined;
        // Handle different exception types
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            }
            else if (typeof exceptionResponse === 'object') {
                const responseObj = exceptionResponse;
                message = responseObj.message || exception.message;
                error = responseObj.error || exception.name;
                details = responseObj.details;
            }
        }
        else if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            error = 'Database Error';
            switch (exception.code) {
                case 'P2002':
                    message = `Duplicate entry: ${exception.meta?.target}`;
                    status = common_1.HttpStatus.CONFLICT;
                    break;
                case 'P2025':
                    message = 'Record not found';
                    status = common_1.HttpStatus.NOT_FOUND;
                    break;
                case 'P2003':
                    message = 'Foreign key constraint failed';
                    break;
                case 'P2014':
                    message = 'Invalid relation';
                    break;
                default:
                    message = `Database error: ${exception.message}`;
            }
        }
        else if (exception instanceof client_1.Prisma.PrismaClientValidationError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = 'Validation error';
            error = 'Validation Error';
        }
        else if (exception instanceof Error) {
            message = exception.message;
            error = exception.name;
            // Log unexpected errors
            this.logger.error(`Unexpected error: ${exception.message}`, exception.stack);
        }
        // Build error response
        const errorResponse = {
            statusCode: status,
            message,
            error,
            timestamp: new Date().toISOString(),
            path: request.url,
            requestId: request.headers['x-request-id'],
        };
        if (details) {
            errorResponse.details = details;
        }
        // Send response
        response.status(status).json(errorResponse);
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = tslib_1.__decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TransformInterceptor = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const operators_1 = __webpack_require__(17);
let TransformInterceptor = class TransformInterceptor {
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        return next.handle().pipe((0, operators_1.map)((data) => ({
            success: true,
            data,
            timestamp: new Date().toISOString(),
            path: request.url,
        })));
    }
};
exports.TransformInterceptor = TransformInterceptor;
exports.TransformInterceptor = TransformInterceptor = tslib_1.__decorate([
    (0, common_1.Injectable)()
], TransformInterceptor);


/***/ }),
/* 17 */
/***/ ((module) => {

module.exports = require("rxjs/operators");

/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LoggingMiddleware = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
let LoggingMiddleware = class LoggingMiddleware {
    constructor() {
        this.logger = new common_1.Logger('HTTP');
    }
    use(request, response, next) {
        const { method, originalUrl, ip } = request;
        const userAgent = request.get('user-agent') || '';
        const startTime = Date.now();
        response.on('finish', () => {
            const { statusCode } = response;
            const contentLength = response.get('content-length');
            const duration = Date.now() - startTime;
            const logMessage = `${method} ${originalUrl} ${statusCode} ${contentLength || 0}bytes ${duration}ms - ${ip} - ${userAgent}`;
            if (statusCode >= 400) {
                this.logger.warn(logMessage);
            }
            else {
                this.logger.log(logMessage);
            }
        });
        next();
    }
};
exports.LoggingMiddleware = LoggingMiddleware;
exports.LoggingMiddleware = LoggingMiddleware = tslib_1.__decorate([
    (0, common_1.Injectable)()
], LoggingMiddleware);


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const jwt_1 = __webpack_require__(20);
const passport_1 = __webpack_require__(21);
const config_1 = __webpack_require__(5);
const auth_controller_1 = __webpack_require__(22);
const auth_service_1 = __webpack_require__(23);
const jwt_strategy_1 = __webpack_require__(29);
const jwt_refresh_strategy_1 = __webpack_require__(31);
const jwt_auth_guard_1 = __webpack_require__(33);
const roles_guard_1 = __webpack_require__(34);
const common_module_1 = __webpack_require__(10);
const prisma_service_1 = __webpack_require__(11);
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [
            common_module_1.CommonModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    secret: configService.get('jwt.secret') || 'your-super-secret-jwt-key-change-in-production',
                    signOptions: {
                        expiresIn: 900, // 15 minutes in seconds
                    },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            {
                provide: jwt_strategy_1.JwtStrategy,
                useFactory: (configService, prisma) => {
                    return new jwt_strategy_1.JwtStrategy(configService, prisma);
                },
                inject: [config_1.ConfigService, prisma_service_1.PrismaService],
            },
            jwt_refresh_strategy_1.LocalStrategy,
            jwt_auth_guard_1.JwtAuthGuard,
            roles_guard_1.RolesGuard,
        ],
        exports: [auth_service_1.AuthService, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard],
    })
], AuthModule);


/***/ }),
/* 20 */
/***/ ((module) => {

module.exports = require("@nestjs/jwt");

/***/ }),
/* 21 */
/***/ ((module) => {

module.exports = require("@nestjs/passport");

/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const auth_service_1 = __webpack_require__(23);
const auth_dto_1 = __webpack_require__(25);
const public_decorator_1 = __webpack_require__(27);
const current_user_decorator_1 = __webpack_require__(28);
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async login(dto) {
        return this.authService.login(dto);
    }
    async register(dto) {
        return this.authService.register(dto);
    }
    async refreshTokens(dto) {
        return this.authService.refreshTokens(dto.refreshToken);
    }
    async logout(user) {
        return this.authService.logout(user.sub);
    }
    async me(user) {
        return this.authService.me(user.sub);
    }
};
exports.AuthController = AuthController;
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Admin login' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_b = typeof auth_dto_1.LoginDto !== "undefined" && auth_dto_1.LoginDto) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register new admin user' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Registration successful' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already registered' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_c = typeof auth_dto_1.RegisterDto !== "undefined" && auth_dto_1.RegisterDto) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token refreshed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid refresh token' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_d = typeof auth_dto_1.RefreshTokenDto !== "undefined" && auth_dto_1.RefreshTokenDto) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", Promise)
], AuthController.prototype, "refreshTokens", null);
tslib_1.__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Logout current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Logout successful' }),
    tslib_1.__param(0, (0, current_user_decorator_1.CurrentUser)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_e = typeof current_user_decorator_1.AdminJwtPayload !== "undefined" && current_user_decorator_1.AdminJwtPayload) === "function" ? _e : Object]),
    tslib_1.__metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
tslib_1.__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User profile' }),
    tslib_1.__param(0, (0, current_user_decorator_1.CurrentUser)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_f = typeof current_user_decorator_1.AdminJwtPayload !== "undefined" && current_user_decorator_1.AdminJwtPayload) === "function" ? _f : Object]),
    tslib_1.__metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
exports.AuthController = AuthController = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof auth_service_1.AuthService !== "undefined" && auth_service_1.AuthService) === "function" ? _a : Object])
], AuthController);


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var AuthService_1;
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AuthService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const jwt_1 = __webpack_require__(20);
const config_1 = __webpack_require__(5);
const bcrypt = tslib_1.__importStar(__webpack_require__(24));
const prisma_service_1 = __webpack_require__(11);
const redis_service_1 = __webpack_require__(13);
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwtService, configService, redisService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
        this.redisService = redisService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async login(dto) {
        const user = await this.prisma.adminUser.findUnique({
            where: { email: dto.email },
        });
        if (!user || user.deletedAt || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        // Update last login
        await this.prisma.adminUser.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            ...tokens,
        };
    }
    async register(dto) {
        // Check if user exists
        const existingUser = await this.prisma.adminUser.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email already registered');
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        // Create user
        const user = await this.prisma.adminUser.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
                role: 'ADMIN',
            },
        });
        const tokens = await this.generateTokens(user.id, user.email, user.role);
        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            ...tokens,
        };
    }
    async refreshTokens(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('jwt.secret'),
            });
            // Check if refresh token is stored
            const storedToken = await this.redisService.get(`refresh:${payload.sub}`);
            if (!storedToken || storedToken !== refreshToken) {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            const user = await this.prisma.adminUser.findUnique({
                where: { id: payload.sub },
            });
            if (!user || !user.isActive) {
                throw new common_1.UnauthorizedException('Invalid credentials');
            }
            return this.generateTokens(user.id, user.email, user.role);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async logout(userId) {
        await this.redisService.del(`refresh:${userId}`);
        return { message: 'Logged out successfully' };
    }
    async me(userId) {
        const user = await this.prisma.adminUser.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return user;
    }
    async generateTokens(userId, email, role) {
        const payload = {
            sub: userId,
            email,
            role,
        };
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: 900, // 15 minutes in seconds
        });
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: 604800, // 7 days in seconds
        });
        // Store refresh token in Redis
        await this.redisService.set(`refresh:${userId}`, refreshToken, 7 * 24 * 60 * 60);
        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof jwt_1.JwtService !== "undefined" && jwt_1.JwtService) === "function" ? _b : Object, typeof (_c = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _c : Object, typeof (_d = typeof redis_service_1.RedisService !== "undefined" && redis_service_1.RedisService) === "function" ? _d : Object])
], AuthService);


/***/ }),
/* 24 */
/***/ ((module) => {

module.exports = require("bcrypt");

/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LoginResponseDto = exports.AuthResponseDto = exports.RefreshTokenDto = exports.RegisterDto = exports.LoginDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
class LoginDto {
}
exports.LoginDto = LoginDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin@shopnx.com' }),
    (0, class_validator_1.IsEmail)(),
    tslib_1.__metadata("design:type", String)
], LoginDto.prototype, "email", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin123', minLength: 6 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    tslib_1.__metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
class RegisterDto {
}
exports.RegisterDto = RegisterDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ example: 'John Doe' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], RegisterDto.prototype, "name", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin@shopnx.com' }),
    (0, class_validator_1.IsEmail)(),
    tslib_1.__metadata("design:type", String)
], RegisterDto.prototype, "email", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ example: 'admin123', minLength: 6 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    tslib_1.__metadata("design:type", String)
], RegisterDto.prototype, "password", void 0);
class RefreshTokenDto {
}
exports.RefreshTokenDto = RefreshTokenDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], RefreshTokenDto.prototype, "refreshToken", void 0);
class AuthResponseDto {
}
exports.AuthResponseDto = AuthResponseDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", String)
], AuthResponseDto.prototype, "accessToken", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", String)
], AuthResponseDto.prototype, "refreshToken", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", Number)
], AuthResponseDto.prototype, "expiresIn", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", Object)
], AuthResponseDto.prototype, "user", void 0);
class LoginResponseDto {
}
exports.LoginResponseDto = LoginResponseDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", String)
], LoginResponseDto.prototype, "accessToken", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", String)
], LoginResponseDto.prototype, "refreshToken", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    tslib_1.__metadata("design:type", Number)
], LoginResponseDto.prototype, "expiresIn", void 0);


/***/ }),
/* 26 */
/***/ ((module) => {

module.exports = require("class-validator");

/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Public = exports.IS_PUBLIC_KEY = void 0;
const common_1 = __webpack_require__(2);
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;


/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CurrentUser = void 0;
const common_1 = __webpack_require__(2);
exports.CurrentUser = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
        return null;
    }
    return data ? user[data] : user;
});


/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JwtStrategy = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const passport_1 = __webpack_require__(21);
const passport_jwt_1 = __webpack_require__(30);
const config_1 = __webpack_require__(5);
const prisma_service_1 = __webpack_require__(11);
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    constructor(configService, prisma) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('jwt.secret') || 'your-super-secret-jwt-key-change-in-production',
        });
        this.prisma = prisma;
    }
    async validate(payload) {
        const user = await this.prisma.adminUser.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                deletedAt: true,
            },
        });
        if (!user || user.deletedAt || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return {
            sub: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object, typeof (_b = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _b : Object])
], JwtStrategy);


/***/ }),
/* 30 */
/***/ ((module) => {

module.exports = require("passport-jwt");

/***/ }),
/* 31 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LocalStrategy = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const passport_1 = __webpack_require__(21);
const passport_local_1 = __webpack_require__(32);
const config_1 = __webpack_require__(5);
const prisma_service_1 = __webpack_require__(11);
let LocalStrategy = class LocalStrategy extends (0, passport_1.PassportStrategy)(passport_local_1.Strategy) {
    constructor(configService, prisma) {
        super({
            usernameField: 'email',
        });
        this.configService = configService;
        this.prisma = prisma;
    }
    async validate(email, password) {
        const user = await this.prisma.adminUser.findUnique({
            where: { email },
        });
        if (!user || user.deletedAt || !user.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        // Note: Password verification is done in the auth service
        return {
            id: user.id,
            email: user.email,
            password: user.password,
            name: user.name,
            role: user.role,
        };
    }
};
exports.LocalStrategy = LocalStrategy;
exports.LocalStrategy = LocalStrategy = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof config_1.ConfigService !== "undefined" && config_1.ConfigService) === "function" ? _a : Object, typeof (_b = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _b : Object])
], LocalStrategy);


/***/ }),
/* 32 */
/***/ ((module) => {

module.exports = require("passport-local");

/***/ }),
/* 33 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JwtAuthGuard = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const passport_1 = __webpack_require__(21);
const public_decorator_1 = __webpack_require__(27);
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor(reflector) {
        super();
        this.reflector = reflector;
    }
    canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        return super.canActivate(context);
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof core_1.Reflector !== "undefined" && core_1.Reflector) === "function" ? _a : Object])
], JwtAuthGuard);


/***/ }),
/* 34 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RolesGuard = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const roles_decorator_1 = __webpack_require__(35);
let RolesGuard = class RolesGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const requiredRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!requiredRoles) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('Access denied');
        }
        const hasRole = requiredRoles.some((role) => user.role === role);
        if (!hasRole) {
            throw new common_1.ForbiddenException(`Access denied. Required roles: ${requiredRoles.join(', ')}`);
        }
        return true;
    }
};
exports.RolesGuard = RolesGuard;
exports.RolesGuard = RolesGuard = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof core_1.Reflector !== "undefined" && core_1.Reflector) === "function" ? _a : Object])
], RolesGuard);


/***/ }),
/* 35 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Roles = exports.ROLES_KEY = void 0;
const common_1 = __webpack_require__(2);
exports.ROLES_KEY = 'roles';
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;


/***/ }),
/* 36 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const users_controller_1 = __webpack_require__(37);
const users_service_1 = __webpack_require__(38);
const common_module_1 = __webpack_require__(10);
const auth_module_1 = __webpack_require__(19);
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [users_controller_1.UsersController],
        providers: [users_service_1.UsersService],
        exports: [users_service_1.UsersService],
    })
], UsersModule);


/***/ }),
/* 37 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const users_service_1 = __webpack_require__(38);
const create_user_dto_1 = __webpack_require__(39);
const pagination_dto_1 = __webpack_require__(40);
const roles_decorator_1 = __webpack_require__(35);
const client_1 = __webpack_require__(12);
let UsersController = class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
    }
    findAll(pagination) {
        return this.usersService.findAll(pagination);
    }
    findOne(id) {
        return this.usersService.findOne(id);
    }
    create(dto) {
        return this.usersService.create(dto);
    }
    update(id, dto) {
        return this.usersService.update(id, dto);
    }
    remove(id) {
        return this.usersService.remove(id);
    }
};
exports.UsersController = UsersController;
tslib_1.__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users (paginated)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of users' }),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_b = typeof pagination_dto_1.PaginationDto !== "undefined" && pagination_dto_1.PaginationDto) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
tslib_1.__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user by ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], UsersController.prototype, "findOne", null);
tslib_1.__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new user' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User created' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Email already registered' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_c = typeof create_user_dto_1.CreateUserDto !== "undefined" && create_user_dto_1.CreateUserDto) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], UsersController.prototype, "create", null);
tslib_1.__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update user' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User updated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_d = typeof create_user_dto_1.UpdateUserDto !== "undefined" && create_user_dto_1.UpdateUserDto) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
tslib_1.__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete user (soft delete)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'User ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiTags)('users'),
    (0, common_1.Controller)('users'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof users_service_1.UsersService !== "undefined" && users_service_1.UsersService) === "function" ? _a : Object])
], UsersController);


/***/ }),
/* 38 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var UsersService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UsersService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const bcrypt = tslib_1.__importStar(__webpack_require__(24));
const prisma_service_1 = __webpack_require__(11);
const client_1 = __webpack_require__(12);
let UsersService = UsersService_1 = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(UsersService_1.name);
    }
    async findAll(pagination) {
        const { page, limit, skip } = pagination;
        const [users, total] = await Promise.all([
            this.prisma.adminUser.findMany({
                where: { deletedAt: null },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    avatar: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            this.prisma.adminUser.count({
                where: { deletedAt: null },
            }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            data: users,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async findOne(id) {
        const user = await this.prisma.adminUser.findUnique({
            where: { id, deletedAt: null },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        }
        return user;
    }
    async create(dto) {
        // Check if email already exists
        const existingUser = await this.prisma.adminUser.findUnique({
            where: { email: dto.email },
        });
        if (existingUser && !existingUser.deletedAt) {
            throw new common_1.ConflictException('Email already registered');
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        // Create user
        const user = await this.prisma.adminUser.create({
            data: {
                name: dto.name,
                email: dto.email,
                password: hashedPassword,
                role: dto.role || client_1.AdminRole.ADMIN,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isActive: true,
                createdAt: true,
            },
        });
        this.logger.log(`User created: ${user.email}`);
        return user;
    }
    async update(id, dto) {
        // Check if user exists
        const existingUser = await this.prisma.adminUser.findUnique({
            where: { id, deletedAt: null },
        });
        if (!existingUser) {
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        }
        // Check email uniqueness if changing email
        if (dto.email && dto.email !== existingUser.email) {
            const emailExists = await this.prisma.adminUser.findUnique({
                where: { email: dto.email },
            });
            if (emailExists) {
                throw new common_1.ConflictException('Email already registered');
            }
        }
        // Prepare update data
        const updateData = {};
        if (dto.name)
            updateData.name = dto.name;
        if (dto.email)
            updateData.email = dto.email;
        if (dto.role)
            updateData.role = dto.role;
        if (dto.isActive !== undefined)
            updateData.isActive = dto.isActive;
        if (dto.password) {
            updateData.password = await bcrypt.hash(dto.password, 10);
            updateData.passwordChangedAt = new Date();
        }
        // Update user
        const user = await this.prisma.adminUser.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatar: true,
                isActive: true,
                updatedAt: true,
            },
        });
        this.logger.log(`User updated: ${user.email}`);
        return user;
    }
    async remove(id) {
        // Check if user exists
        const existingUser = await this.prisma.adminUser.findUnique({
            where: { id, deletedAt: null },
        });
        if (!existingUser) {
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        }
        // Soft delete
        await this.prisma.adminUser.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.logger.log(`User deleted: ${existingUser.email}`);
        return { message: 'User deleted successfully' };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], UsersService);


/***/ }),
/* 39 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UpdateUserDto = exports.CreateUserDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const client_1 = __webpack_require__(12);
class CreateUserDto {
}
exports.CreateUserDto = CreateUserDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], CreateUserDto.prototype, "name", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsEmail)(),
    tslib_1.__metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ minLength: 6 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    tslib_1.__metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.AdminRole, default: 'ADMIN' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AdminRole),
    tslib_1.__metadata("design:type", typeof (_a = typeof client_1.AdminRole !== "undefined" && client_1.AdminRole) === "function" ? _a : Object)
], CreateUserDto.prototype, "role", void 0);
class UpdateUserDto {
}
exports.UpdateUserDto = UpdateUserDto;
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], UpdateUserDto.prototype, "name", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    tslib_1.__metadata("design:type", String)
], UpdateUserDto.prototype, "email", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minLength: 6 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    tslib_1.__metadata("design:type", String)
], UpdateUserDto.prototype, "password", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.AdminRole }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AdminRole),
    tslib_1.__metadata("design:type", typeof (_b = typeof client_1.AdminRole !== "undefined" && client_1.AdminRole) === "function" ? _b : Object)
], UpdateUserDto.prototype, "role", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], UpdateUserDto.prototype, "isActive", void 0);


/***/ }),
/* 40 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PaginationDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const class_transformer_1 = __webpack_require__(41);
const swagger_1 = __webpack_require__(4);
class PaginationDto {
    constructor() {
        this.page = 1;
        this.limit = 10;
    }
    get skip() {
        return (this.page - 1) * this.limit;
    }
}
exports.PaginationDto = PaginationDto;
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1, minimum: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number)
], PaginationDto.prototype, "page", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 10, minimum: 1, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    tslib_1.__metadata("design:type", Number)
], PaginationDto.prototype, "limit", void 0);


/***/ }),
/* 41 */
/***/ ((module) => {

module.exports = require("class-transformer");

/***/ }),
/* 42 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProductsModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const products_controller_1 = __webpack_require__(43);
const products_service_1 = __webpack_require__(44);
const common_module_1 = __webpack_require__(10);
const auth_module_1 = __webpack_require__(19);
let ProductsModule = class ProductsModule {
};
exports.ProductsModule = ProductsModule;
exports.ProductsModule = ProductsModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [products_controller_1.ProductsController],
        providers: [products_service_1.ProductsService],
        exports: [products_service_1.ProductsService],
    })
], ProductsModule);


/***/ }),
/* 43 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProductsController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const products_service_1 = __webpack_require__(44);
const create_product_dto_1 = __webpack_require__(45);
const update_product_dto_1 = __webpack_require__(46);
const query_product_dto_1 = __webpack_require__(47);
const public_decorator_1 = __webpack_require__(27);
const roles_decorator_1 = __webpack_require__(35);
const client_1 = __webpack_require__(12);
let ProductsController = class ProductsController {
    constructor(productsService) {
        this.productsService = productsService;
    }
    findAll(query) {
        return this.productsService.findAll(query);
    }
    findBySlug(slug) {
        return this.productsService.findBySlug(slug);
    }
    findOne(id) {
        return this.productsService.findOne(id);
    }
    create(dto) {
        return this.productsService.create(dto);
    }
    update(id, dto) {
        return this.productsService.update(id, dto);
    }
    remove(id) {
        return this.productsService.remove(id);
    }
};
exports.ProductsController = ProductsController;
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all products (public)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of products' }),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_b = typeof query_product_dto_1.QueryProductDto !== "undefined" && query_product_dto_1.QueryProductDto) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], ProductsController.prototype, "findAll", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('slug/:slug'),
    (0, swagger_1.ApiOperation)({ summary: 'Get product by slug (public)' }),
    (0, swagger_1.ApiParam)({ name: 'slug', description: 'Product slug' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Product details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    tslib_1.__param(0, (0, common_1.Param)('slug')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], ProductsController.prototype, "findBySlug", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get product by ID (public)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Product ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Product details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], ProductsController.prototype, "findOne", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new product (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Product created' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'SKU or slug already exists' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_c = typeof create_product_dto_1.CreateProductDto !== "undefined" && create_product_dto_1.CreateProductDto) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Update product (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Product ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Product updated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_d = typeof update_product_dto_1.UpdateProductDto !== "undefined" && update_product_dto_1.UpdateProductDto) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], ProductsController.prototype, "update", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete product (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Product ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Product deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], ProductsController.prototype, "remove", null);
exports.ProductsController = ProductsController = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('products'),
    (0, common_1.Controller)('products'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof products_service_1.ProductsService !== "undefined" && products_service_1.ProductsService) === "function" ? _a : Object])
], ProductsController);


/***/ }),
/* 44 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var ProductsService_1;
var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProductsService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
const redis_service_1 = __webpack_require__(13);
const CACHE_KEY_PREFIX = 'products';
const CACHE_TTL = 300; // 5 minutes
let ProductsService = ProductsService_1 = class ProductsService {
    constructor(prisma, redisService) {
        this.prisma = prisma;
        this.redisService = redisService;
        this.logger = new common_1.Logger(ProductsService_1.name);
    }
    async findAll(query) {
        const { page = 1, limit = 10, search, type, categoryId, isActive, isFeatured, minPrice, maxPrice, sortBy, sortOrder, } = query;
        const skip = (page - 1) * limit;
        // Build cache key
        const cacheKey = `${CACHE_KEY_PREFIX}:list:${JSON.stringify(query)}`;
        // Try to get from cache
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            return cached;
        }
        // Build where clause
        const where = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { sku: { contains: search } },
                { description: { contains: search } },
            ];
        }
        if (type) {
            where.type = type;
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (isActive !== undefined) {
            where.isActive = isActive;
        }
        if (isFeatured !== undefined) {
            where.isFeatured = isFeatured;
        }
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {};
            if (minPrice !== undefined) {
                where.price.gte = minPrice;
            }
            if (maxPrice !== undefined) {
                where.price.lte = maxPrice;
            }
        }
        // Build order by
        const orderBy = {};
        orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';
        // Execute queries
        const [products, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    category: {
                        select: { id: true, name: true, slug: true },
                    },
                    images: {
                        orderBy: { order: 'asc' },
                    },
                    variants: {
                        where: { isActive: true },
                    },
                },
            }),
            this.prisma.product.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        const result = {
            data: products,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
        // Cache the result
        await this.redisService.set(cacheKey, result, CACHE_TTL);
        return result;
    }
    async findOne(id) {
        const product = await this.prisma.product.findUnique({
            where: { id, deletedAt: null },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
                images: {
                    orderBy: { order: 'asc' },
                },
                variants: {
                    where: { isActive: true },
                },
            },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        return product;
    }
    async findBySlug(slug) {
        const product = await this.prisma.product.findUnique({
            where: { slug, deletedAt: null },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
                images: {
                    orderBy: { order: 'asc' },
                },
                variants: {
                    where: { isActive: true },
                },
            },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with slug ${slug} not found`);
        }
        return product;
    }
    async create(dto) {
        // Check if SKU exists
        const existingSku = await this.prisma.product.findUnique({
            where: { sku: dto.sku },
        });
        if (existingSku && !existingSku.deletedAt) {
            throw new common_1.ConflictException(`Product with SKU ${dto.sku} already exists`);
        }
        // Check if slug exists
        const existingSlug = await this.prisma.product.findUnique({
            where: { slug: dto.slug },
        });
        if (existingSlug && !existingSlug.deletedAt) {
            throw new common_1.ConflictException(`Product with slug ${dto.slug} already exists`);
        }
        // Create product
        const product = await this.prisma.product.create({
            data: {
                sku: dto.sku,
                name: dto.name,
                slug: dto.slug,
                description: dto.description,
                type: dto.type || 'PHYSICAL',
                price: dto.price,
                comparePrice: dto.comparePrice,
                costPrice: dto.costPrice,
                inventoryQuantity: dto.inventoryQuantity || 0,
                inventoryTracked: dto.inventoryTracked ?? true,
                lowStockThreshold: dto.lowStockThreshold || 10,
                weight: dto.weight,
                length: dto.length,
                width: dto.width,
                height: dto.height,
                downloadUrl: dto.downloadUrl,
                downloadLimit: dto.downloadLimit,
                downloadExpiry: dto.downloadExpiry,
                ownerName: dto.ownerName,
                ownerWhatsapp: dto.ownerWhatsapp,
                categoryId: dto.categoryId,
                image: dto.image,
                isActive: dto.isActive ?? true,
                isFeatured: dto.isFeatured ?? false,
                metaTitle: dto.metaTitle,
                metaDescription: dto.metaDescription,
            },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });
        // Clear cache
        await this.clearCache();
        this.logger.log(`Product created: ${product.sku}`);
        return product;
    }
    async update(id, dto) {
        // Check if product exists
        const existingProduct = await this.prisma.product.findUnique({
            where: { id, deletedAt: null },
        });
        if (!existingProduct) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        // Check SKU uniqueness if changing
        if (dto.sku && dto.sku !== existingProduct.sku) {
            const existingSku = await this.prisma.product.findUnique({
                where: { sku: dto.sku },
            });
            if (existingSku && !existingSku.deletedAt) {
                throw new common_1.ConflictException(`Product with SKU ${dto.sku} already exists`);
            }
        }
        // Check slug uniqueness if changing
        if (dto.slug && dto.slug !== existingProduct.slug) {
            const existingSlug = await this.prisma.product.findUnique({
                where: { slug: dto.slug },
            });
            if (existingSlug && !existingSlug.deletedAt) {
                throw new common_1.ConflictException(`Product with slug ${dto.slug} already exists`);
            }
        }
        // Update product
        const product = await this.prisma.product.update({
            where: { id },
            data: {
                ...dto,
                updatedAt: new Date(),
            },
            include: {
                category: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });
        // Clear cache
        await this.clearCache();
        this.logger.log(`Product updated: ${product.sku}`);
        return product;
    }
    async remove(id) {
        // Check if product exists
        const existingProduct = await this.prisma.product.findUnique({
            where: { id, deletedAt: null },
        });
        if (!existingProduct) {
            throw new common_1.NotFoundException(`Product with ID ${id} not found`);
        }
        // Soft delete
        await this.prisma.product.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        // Clear cache
        await this.clearCache();
        this.logger.log(`Product deleted: ${existingProduct.sku}`);
        return { message: 'Product deleted successfully' };
    }
    async clearCache() {
        await this.redisService.delPattern(`${CACHE_KEY_PREFIX}:*`);
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = ProductsService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object, typeof (_b = typeof redis_service_1.RedisService !== "undefined" && redis_service_1.RedisService) === "function" ? _b : Object])
], ProductsService);


/***/ }),
/* 45 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CreateProductDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const client_1 = __webpack_require__(12);
const class_transformer_1 = __webpack_require__(41);
class CreateProductDto {
}
exports.CreateProductDto = CreateProductDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "sku", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "name", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "slug", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "description", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.ProductType, default: 'PHYSICAL' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ProductType),
    tslib_1.__metadata("design:type", typeof (_a = typeof client_1.ProductType !== "undefined" && client_1.ProductType) === "function" ? _a : Object)
], CreateProductDto.prototype, "type", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "price", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "comparePrice", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "costPrice", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "inventoryQuantity", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], CreateProductDto.prototype, "inventoryTracked", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "lowStockThreshold", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "weight", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "length", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "width", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "height", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "downloadUrl", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "downloadLimit", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number)
], CreateProductDto.prototype, "downloadExpiry", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "ownerName", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "ownerWhatsapp", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "categoryId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "image", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], CreateProductDto.prototype, "isActive", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], CreateProductDto.prototype, "isFeatured", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "metaTitle", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    tslib_1.__metadata("design:type", String)
], CreateProductDto.prototype, "metaDescription", void 0);


/***/ }),
/* 46 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UpdateProductDto = void 0;
const swagger_1 = __webpack_require__(4);
const create_product_dto_1 = __webpack_require__(45);
class UpdateProductDto extends (0, swagger_1.PartialType)(create_product_dto_1.CreateProductDto) {
}
exports.UpdateProductDto = UpdateProductDto;


/***/ }),
/* 47 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueryProductDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const class_transformer_1 = __webpack_require__(41);
const swagger_1 = __webpack_require__(4);
const pagination_dto_1 = __webpack_require__(40);
const client_1 = __webpack_require__(12);
class QueryProductDto extends pagination_dto_1.PaginationDto {
}
exports.QueryProductDto = QueryProductDto;
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryProductDto.prototype, "search", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.ProductType }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ProductType),
    tslib_1.__metadata("design:type", typeof (_a = typeof client_1.ProductType !== "undefined" && client_1.ProductType) === "function" ? _a : Object)
], QueryProductDto.prototype, "type", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryProductDto.prototype, "categoryId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], QueryProductDto.prototype, "isActive", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], QueryProductDto.prototype, "isFeatured", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], QueryProductDto.prototype, "minPrice", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], QueryProductDto.prototype, "maxPrice", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 'createdAt' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryProductDto.prototype, "sortBy", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['asc', 'desc'], default: 'desc' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryProductDto.prototype, "sortOrder", void 0);


/***/ }),
/* 48 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CategoriesModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const categories_controller_1 = __webpack_require__(49);
const categories_service_1 = __webpack_require__(50);
const common_module_1 = __webpack_require__(10);
const auth_module_1 = __webpack_require__(19);
let CategoriesModule = class CategoriesModule {
};
exports.CategoriesModule = CategoriesModule;
exports.CategoriesModule = CategoriesModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [categories_controller_1.CategoriesController],
        providers: [categories_service_1.CategoriesService],
        exports: [categories_service_1.CategoriesService],
    })
], CategoriesModule);


/***/ }),
/* 49 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CategoriesController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const categories_service_1 = __webpack_require__(50);
const create_category_dto_1 = __webpack_require__(51);
const update_category_dto_1 = __webpack_require__(52);
const public_decorator_1 = __webpack_require__(27);
const roles_decorator_1 = __webpack_require__(35);
const client_1 = __webpack_require__(12);
let CategoriesController = class CategoriesController {
    constructor(categoriesService) {
        this.categoriesService = categoriesService;
    }
    findAll() {
        return this.categoriesService.findAll();
    }
    findTree() {
        return this.categoriesService.findTree();
    }
    findOne(id) {
        return this.categoriesService.findOne(id);
    }
    create(dto) {
        return this.categoriesService.create(dto);
    }
    update(id, dto) {
        return this.categoriesService.update(id, dto);
    }
    remove(id) {
        return this.categoriesService.remove(id);
    }
};
exports.CategoriesController = CategoriesController;
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get all categories (public)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of categories' }),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], CategoriesController.prototype, "findAll", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('tree'),
    (0, swagger_1.ApiOperation)({ summary: 'Get category tree (public)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Category tree structure' }),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], CategoriesController.prototype, "findTree", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get category by ID (public)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Category ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Category details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Category not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], CategoriesController.prototype, "findOne", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new category (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Category created' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Slug already exists' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_b = typeof create_category_dto_1.CreateCategoryDto !== "undefined" && create_category_dto_1.CreateCategoryDto) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], CategoriesController.prototype, "create", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Update category (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Category ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Category updated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Category not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_c = typeof update_category_dto_1.UpdateCategoryDto !== "undefined" && update_category_dto_1.UpdateCategoryDto) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], CategoriesController.prototype, "update", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Delete category (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Category ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Category deleted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Category not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Category has children' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], CategoriesController.prototype, "remove", null);
exports.CategoriesController = CategoriesController = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('categories'),
    (0, common_1.Controller)('categories'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof categories_service_1.CategoriesService !== "undefined" && categories_service_1.CategoriesService) === "function" ? _a : Object])
], CategoriesController);


/***/ }),
/* 50 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var CategoriesService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CategoriesService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
let CategoriesService = CategoriesService_1 = class CategoriesService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(CategoriesService_1.name);
    }
    async findAll() {
        const categories = await this.prisma.category.findMany({
            where: { deletedAt: null },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            include: {
                parent: {
                    select: { id: true, name: true, slug: true },
                },
                children: {
                    where: { deletedAt: null },
                    select: { id: true, name: true, slug: true },
                },
                _count: {
                    select: { products: { where: { deletedAt: null } } },
                },
            },
        });
        return categories.map((cat) => ({
            ...cat,
            productCount: cat._count.products,
        }));
    }
    async findTree() {
        const categories = await this.prisma.category.findMany({
            where: { deletedAt: null, parentId: null },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            include: {
                children: {
                    where: { deletedAt: null },
                    orderBy: [{ order: 'asc' }, { name: 'asc' }],
                    include: {
                        children: {
                            where: { deletedAt: null },
                            orderBy: [{ order: 'asc' }, { name: 'asc' }],
                        },
                        _count: {
                            select: { products: { where: { deletedAt: null } } },
                        },
                    },
                },
                _count: {
                    select: { products: { where: { deletedAt: null } } },
                },
            },
        });
        return categories.map((cat) => ({
            ...cat,
            productCount: cat._count.products,
            children: cat.children.map((child) => ({
                ...child,
                productCount: child._count.products,
            })),
        }));
    }
    async findOne(id) {
        const category = await this.prisma.category.findUnique({
            where: { id, deletedAt: null },
            include: {
                parent: {
                    select: { id: true, name: true, slug: true },
                },
                children: {
                    where: { deletedAt: null },
                    select: { id: true, name: true, slug: true },
                },
                _count: {
                    select: { products: { where: { deletedAt: null } } },
                },
            },
        });
        if (!category) {
            throw new common_1.NotFoundException(`Category with ID ${id} not found`);
        }
        return {
            ...category,
            productCount: category._count.products,
        };
    }
    async create(dto) {
        // Check if slug exists
        const existingSlug = await this.prisma.category.findUnique({
            where: { slug: dto.slug },
        });
        if (existingSlug && !existingSlug.deletedAt) {
            throw new common_1.ConflictException(`Category with slug ${dto.slug} already exists`);
        }
        // Check if parent exists
        if (dto.parentId) {
            const parent = await this.prisma.category.findUnique({
                where: { id: dto.parentId, deletedAt: null },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Parent category with ID ${dto.parentId} not found`);
            }
        }
        const category = await this.prisma.category.create({
            data: {
                name: dto.name,
                slug: dto.slug,
                description: dto.description,
                image: dto.image,
                parentId: dto.parentId,
                order: dto.order || 0,
                isActive: dto.isActive ?? true,
                metaTitle: dto.metaTitle,
                metaDescription: dto.metaDescription,
            },
            include: {
                parent: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });
        this.logger.log(`Category created: ${category.slug}`);
        return category;
    }
    async update(id, dto) {
        // Check if category exists
        const existingCategory = await this.prisma.category.findUnique({
            where: { id, deletedAt: null },
        });
        if (!existingCategory) {
            throw new common_1.NotFoundException(`Category with ID ${id} not found`);
        }
        // Check slug uniqueness if changing
        if (dto.slug && dto.slug !== existingCategory.slug) {
            const existingSlug = await this.prisma.category.findUnique({
                where: { slug: dto.slug },
            });
            if (existingSlug && !existingSlug.deletedAt) {
                throw new common_1.ConflictException(`Category with slug ${dto.slug} already exists`);
            }
        }
        // Check if parent exists and not setting parent to itself
        if (dto.parentId) {
            if (dto.parentId === id) {
                throw new common_1.BadRequestException('Cannot set category as its own parent');
            }
            const parent = await this.prisma.category.findUnique({
                where: { id: dto.parentId, deletedAt: null },
            });
            if (!parent) {
                throw new common_1.NotFoundException(`Parent category with ID ${dto.parentId} not found`);
            }
            // Check for circular reference
            const isCircular = await this.checkCircularReference(id, dto.parentId);
            if (isCircular) {
                throw new common_1.BadRequestException('Circular reference detected in category hierarchy');
            }
        }
        const category = await this.prisma.category.update({
            where: { id },
            data: {
                ...dto,
                updatedAt: new Date(),
            },
            include: {
                parent: {
                    select: { id: true, name: true, slug: true },
                },
            },
        });
        this.logger.log(`Category updated: ${category.slug}`);
        return category;
    }
    async remove(id) {
        // Check if category exists
        const existingCategory = await this.prisma.category.findUnique({
            where: { id, deletedAt: null },
            include: {
                children: { where: { deletedAt: null } },
                products: { where: { deletedAt: null } },
            },
        });
        if (!existingCategory) {
            throw new common_1.NotFoundException(`Category with ID ${id} not found`);
        }
        // Check if category has children
        if (existingCategory.children.length > 0) {
            throw new common_1.BadRequestException('Cannot delete category with children. Remove children first.');
        }
        // Soft delete
        await this.prisma.category.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        this.logger.log(`Category deleted: ${existingCategory.slug}`);
        return { message: 'Category deleted successfully' };
    }
    async checkCircularReference(categoryId, newParentId) {
        let currentParentId = newParentId;
        while (currentParentId) {
            if (currentParentId === categoryId) {
                return true;
            }
            const parent = await this.prisma.category.findUnique({
                where: { id: currentParentId, deletedAt: null },
                select: { parentId: true },
            });
            currentParentId = parent?.parentId;
        }
        return false;
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = CategoriesService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], CategoriesService);


/***/ }),
/* 51 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CreateCategoryDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const class_transformer_1 = __webpack_require__(41);
class CreateCategoryDto {
}
exports.CreateCategoryDto = CreateCategoryDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "name", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "slug", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "description", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "image", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "parentId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    tslib_1.__metadata("design:type", Number)
], CreateCategoryDto.prototype, "order", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean)
], CreateCategoryDto.prototype, "isActive", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "metaTitle", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    tslib_1.__metadata("design:type", String)
], CreateCategoryDto.prototype, "metaDescription", void 0);


/***/ }),
/* 52 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UpdateCategoryDto = void 0;
const swagger_1 = __webpack_require__(4);
const create_category_dto_1 = __webpack_require__(51);
class UpdateCategoryDto extends (0, swagger_1.PartialType)(create_category_dto_1.CreateCategoryDto) {
}
exports.UpdateCategoryDto = UpdateCategoryDto;


/***/ }),
/* 53 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OrdersModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const orders_controller_1 = __webpack_require__(54);
const orders_service_1 = __webpack_require__(55);
const common_module_1 = __webpack_require__(10);
const auth_module_1 = __webpack_require__(19);
let OrdersModule = class OrdersModule {
};
exports.OrdersModule = OrdersModule;
exports.OrdersModule = OrdersModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [orders_controller_1.OrdersController],
        providers: [orders_service_1.OrdersService],
        exports: [orders_service_1.OrdersService],
    })
], OrdersModule);


/***/ }),
/* 54 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OrdersController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const orders_service_1 = __webpack_require__(55);
const create_order_dto_1 = __webpack_require__(56);
const update_order_dto_1 = __webpack_require__(57);
const query_order_dto_1 = __webpack_require__(58);
const public_decorator_1 = __webpack_require__(27);
const roles_decorator_1 = __webpack_require__(35);
const client_1 = __webpack_require__(12);
let OrdersController = class OrdersController {
    constructor(ordersService) {
        this.ordersService = ordersService;
    }
    findAll(query) {
        return this.ordersService.findAll(query);
    }
    findOne(id) {
        return this.ordersService.findOne(id);
    }
    generateWhatsAppLink(id) {
        return this.ordersService.generateWhatsAppLink(id);
    }
    create(dto) {
        return this.ordersService.create(dto);
    }
    update(id, dto) {
        return this.ordersService.update(id, dto);
    }
    remove(id) {
        return this.ordersService.remove(id);
    }
};
exports.OrdersController = OrdersController;
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER, client_1.AdminRole.VIEWER),
    (0, swagger_1.ApiOperation)({ summary: 'Get all orders (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of orders' }),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_b = typeof query_order_dto_1.QueryOrderDto !== "undefined" && query_order_dto_1.QueryOrderDto) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], OrdersController.prototype, "findAll", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get order by ID (public)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order details' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], OrdersController.prototype, "findOne", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id/whatsapp'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate WhatsApp checkout link (public)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'WhatsApp URL' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], OrdersController.prototype, "generateWhatsAppLink", null);
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new order (public)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Order created' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid products or insufficient stock' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_c = typeof create_order_dto_1.CreateOrderDto !== "undefined" && create_order_dto_1.CreateOrderDto) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Update order (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order updated' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_d = typeof update_order_dto_1.UpdateOrderDto !== "undefined" && update_order_dto_1.UpdateOrderDto) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], OrdersController.prototype, "update", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel order (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order cancelled' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Only pending orders can be cancelled' }),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], OrdersController.prototype, "remove", null);
exports.OrdersController = OrdersController = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('orders'),
    (0, common_1.Controller)('orders'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof orders_service_1.OrdersService !== "undefined" && orders_service_1.OrdersService) === "function" ? _a : Object])
], OrdersController);


/***/ }),
/* 55 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var OrdersService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OrdersService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
const client_1 = __webpack_require__(12);
let OrdersService = OrdersService_1 = class OrdersService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(OrdersService_1.name);
    }
    async findAll(query) {
        const { page = 1, limit = 10, status, paymentStatus, customerId, search, startDate, endDate } = query;
        const skip = (page - 1) * limit;
        // Build where clause
        const where = {};
        if (status) {
            where.status = status;
        }
        if (paymentStatus) {
            where.paymentStatus = paymentStatus;
        }
        if (customerId) {
            where.customerId = customerId;
        }
        if (search) {
            where.OR = [
                { orderNumber: { contains: search } },
                { customerName: { contains: search } },
                { customerEmail: { contains: search } },
                { customerPhone: { contains: search } },
            ];
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }
        // Execute queries
        const [orders, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: {
                        select: { id: true, name: true, email: true, phone: true },
                    },
                    items: {
                        include: {
                            product: {
                                select: { id: true, name: true, sku: true, image: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.order.count({ where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            data: orders,
            meta: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    async findOne(id) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: {
                customer: {
                    select: { id: true, name: true, email: true, phone: true, whatsappNumber: true },
                },
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, sku: true, image: true, type: true },
                        },
                    },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException(`Order with ID ${id} not found`);
        }
        return order;
    }
    async create(dto) {
        // Validate products and get prices
        const productIds = dto.items.map((item) => item.productId);
        const products = await this.prisma.product.findMany({
            where: {
                id: { in: productIds },
                deletedAt: null,
                isActive: true,
            },
            include: {
                variants: dto.items.some((i) => i.variantId)
                    ? { where: { isActive: true } }
                    : false,
            },
        });
        if (products.length !== productIds.length) {
            throw new common_1.BadRequestException('One or more products not found or inactive');
        }
        // Build order items with price snapshots
        const orderItems = [];
        let subtotal = 0;
        for (const item of dto.items) {
            const product = products.find((p) => p.id === item.productId);
            if (!product) {
                throw new common_1.BadRequestException(`Product ${item.productId} not found`);
            }
            let unitPrice = product.price;
            let variantName;
            if (item.variantId) {
                const variant = product.variants?.find((v) => v.id === item.variantId);
                if (!variant) {
                    throw new common_1.BadRequestException(`Variant ${item.variantId} not found`);
                }
                unitPrice = variant.price;
                variantName = variant.name;
            }
            const totalPrice = unitPrice * item.quantity;
            subtotal += totalPrice;
            orderItems.push({
                product: { connect: { id: product.id } },
                productSku: product.sku,
                productName: product.name,
                productImage: product.image,
                variantId: item.variantId,
                variantName,
                unitPrice,
                totalPrice,
                quantity: item.quantity,
                productType: product.type,
                downloadUrl: product.downloadUrl,
                downloadLimit: product.downloadLimit,
            });
            // Check inventory for physical products
            if (product.type === 'PHYSICAL' && product.inventoryTracked) {
                const availableStock = item.variantId
                    ? product.variants?.find((v) => v.id === item.variantId)?.inventoryQuantity || 0
                    : product.inventoryQuantity;
                if (availableStock < item.quantity) {
                    throw new common_1.BadRequestException(`Insufficient stock for ${product.name}. Available: ${availableStock}`);
                }
            }
        }
        // Generate order number
        const orderNumber = await this.generateOrderNumber();
        // Create order
        const order = await this.prisma.order.create({
            data: {
                orderNumber,
                customerId: dto.customerId,
                customerName: dto.customerName,
                customerEmail: dto.customerEmail,
                customerPhone: dto.customerPhone,
                customerWhatsapp: dto.customerWhatsapp,
                shippingName: dto.shippingName,
                shippingPhone: dto.shippingPhone,
                shippingAddress: dto.shippingAddress,
                shippingCity: dto.shippingCity,
                shippingProvince: dto.shippingProvince,
                shippingPostalCode: dto.shippingPostalCode,
                shippingCountry: dto.shippingCountry || 'Indonesia',
                subtotal,
                total: subtotal, // Will be updated with shipping, tax, etc.
                couponCode: dto.couponCode,
                customerNotes: dto.customerNotes,
                items: {
                    create: orderItems,
                },
            },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, sku: true, image: true },
                        },
                    },
                },
            },
        });
        // Decrease inventory for physical products
        for (const item of dto.items) {
            const product = products.find((p) => p.id === item.productId);
            if (product?.type === 'PHYSICAL' && product.inventoryTracked) {
                await this.decreaseInventory(item.productId, item.variantId, item.quantity);
            }
        }
        this.logger.log(`Order created: ${order.orderNumber}`);
        return order;
    }
    async update(id, dto) {
        // Check if order exists
        const existingOrder = await this.prisma.order.findUnique({
            where: { id },
        });
        if (!existingOrder) {
            throw new common_1.NotFoundException(`Order with ID ${id} not found`);
        }
        // Prepare update data
        const updateData = {};
        if (dto.status) {
            updateData.status = dto.status;
            // Update timestamps based on status
            if (dto.status === client_1.OrderStatus.CONFIRMED && !existingOrder.confirmedAt) {
                updateData.confirmedAt = new Date();
            }
            if (dto.status === client_1.OrderStatus.CANCELLED && !existingOrder.cancelledAt) {
                updateData.cancelledAt = new Date();
            }
            if (dto.status === client_1.OrderStatus.REFUNDED && !existingOrder.refundedAt) {
                updateData.refundedAt = new Date();
            }
        }
        if (dto.paymentStatus) {
            updateData.paymentStatus = dto.paymentStatus;
            if (dto.paymentStatus === client_1.PaymentStatus.PAID && !existingOrder.paidAt) {
                updateData.paidAt = new Date();
            }
        }
        if (dto.paymentId) {
            updateData.paymentId = dto.paymentId;
        }
        if (dto.trackingNumber) {
            updateData.trackingNumber = dto.trackingNumber;
        }
        if (dto.shippingProvider) {
            updateData.shippingProvider = dto.shippingProvider;
        }
        if (dto.adminNotes) {
            updateData.adminNotes = dto.adminNotes;
        }
        // Update order
        const order = await this.prisma.order.update({
            where: { id },
            data: updateData,
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, sku: true, image: true },
                        },
                    },
                },
            },
        });
        this.logger.log(`Order updated: ${order.orderNumber}`);
        return order;
    }
    async remove(id) {
        // Check if order exists
        const existingOrder = await this.prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!existingOrder) {
            throw new common_1.NotFoundException(`Order with ID ${id} not found`);
        }
        // Only allow cancellation of pending orders
        if (existingOrder.status !== client_1.OrderStatus.PENDING) {
            throw new common_1.BadRequestException('Only pending orders can be cancelled');
        }
        // Restore inventory
        for (const item of existingOrder.items) {
            if (item.productId) {
                await this.increaseInventory(item.productId, item.variantId, item.quantity);
            }
        }
        // Cancel order
        const order = await this.prisma.order.update({
            where: { id },
            data: {
                status: client_1.OrderStatus.CANCELLED,
                cancelledAt: new Date(),
            },
        });
        this.logger.log(`Order cancelled: ${order.orderNumber}`);
        return { message: 'Order cancelled successfully' };
    }
    async generateWhatsAppLink(orderId) {
        const order = await this.findOne(orderId);
        // Get WhatsApp number (prefer owner's WhatsApp if available)
        const phoneNumber = order.customerWhatsapp || order.customerPhone;
        if (!phoneNumber) {
            throw new common_1.BadRequestException('No WhatsApp number available for this order');
        }
        // Format phone number (remove non-digits)
        const formattedPhone = phoneNumber.replace(/\D/g, '');
        // Build message
        const items = order.items
            .map((item) => `- ${item.productName} x${item.quantity} = Rp ${this.formatPrice(item.totalPrice)}`)
            .join('\n');
        const message = `Halo, saya ingin memesan:
    
Order ID: ${order.orderNumber}

${items}

Total: Rp ${this.formatPrice(order.total)}

Nama: ${order.shippingName}
Alamat: ${order.shippingAddress}, ${order.shippingCity}, ${order.shippingProvince} ${order.shippingPostalCode}

Mohon konfirmasi pesanan saya. Terima kasih!`;
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
        return { url };
    }
    async generateOrderNumber() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        // Get count of orders today
        const todayStart = new Date(date.setHours(0, 0, 0, 0));
        const todayEnd = new Date(date.setHours(23, 59, 59, 999));
        const count = await this.prisma.order.count({
            where: {
                createdAt: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            },
        });
        const sequence = (count + 1).toString().padStart(4, '0');
        return `ORD-${dateStr}-${sequence}`;
    }
    async decreaseInventory(productId, variantId, quantity) {
        if (variantId) {
            await this.prisma.productVariant.update({
                where: { id: variantId },
                data: { inventoryQuantity: { decrement: quantity } },
            });
        }
        await this.prisma.product.update({
            where: { id: productId },
            data: { inventoryQuantity: { decrement: quantity } },
        });
        // Create inventory movement record
        await this.prisma.inventoryMovement.create({
            data: {
                productId,
                variantId,
                type: 'SALE',
                quantity: -quantity,
                reason: 'Order placed',
                previousStock: 0, // Will be updated by trigger or ignored
                newStock: 0,
            },
        });
    }
    async increaseInventory(productId, variantId, quantity) {
        if (variantId) {
            await this.prisma.productVariant.update({
                where: { id: variantId },
                data: { inventoryQuantity: { increment: quantity } },
            });
        }
        await this.prisma.product.update({
            where: { id: productId },
            data: { inventoryQuantity: { increment: quantity } },
        });
        // Create inventory movement record
        await this.prisma.inventoryMovement.create({
            data: {
                productId,
                variantId,
                type: 'RETURN',
                quantity,
                reason: 'Order cancelled',
                previousStock: 0,
                newStock: 0,
            },
        });
    }
    formatPrice(price) {
        return price.toLocaleString('id-ID');
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = OrdersService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], OrdersService);


/***/ }),
/* 56 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CreateOrderDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const class_transformer_1 = __webpack_require__(41);
class OrderItemDto {
}
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], OrderItemDto.prototype, "productId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], OrderItemDto.prototype, "variantId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number)
], OrderItemDto.prototype, "quantity", void 0);
class CreateOrderDto {
}
exports.CreateOrderDto = CreateOrderDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "customerName", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "customerEmail", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "customerPhone", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "customerWhatsapp", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingName", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(50),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingPhone", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingAddress", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingCity", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingProvince", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(20),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingPostalCode", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "shippingCountry", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ type: [OrderItemDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => OrderItemDto),
    tslib_1.__metadata("design:type", Array)
], CreateOrderDto.prototype, "items", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "customerId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "customerNotes", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    tslib_1.__metadata("design:type", String)
], CreateOrderDto.prototype, "couponCode", void 0);


/***/ }),
/* 57 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UpdateOrderDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const client_1 = __webpack_require__(12);
class UpdateOrderDto {
}
exports.UpdateOrderDto = UpdateOrderDto;
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.OrderStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OrderStatus),
    tslib_1.__metadata("design:type", typeof (_a = typeof client_1.OrderStatus !== "undefined" && client_1.OrderStatus) === "function" ? _a : Object)
], UpdateOrderDto.prototype, "status", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PaymentStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentStatus),
    tslib_1.__metadata("design:type", typeof (_b = typeof client_1.PaymentStatus !== "undefined" && client_1.PaymentStatus) === "function" ? _b : Object)
], UpdateOrderDto.prototype, "paymentStatus", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], UpdateOrderDto.prototype, "paymentId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], UpdateOrderDto.prototype, "trackingNumber", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], UpdateOrderDto.prototype, "shippingProvider", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], UpdateOrderDto.prototype, "adminNotes", void 0);


/***/ }),
/* 58 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueryOrderDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const pagination_dto_1 = __webpack_require__(40);
const client_1 = __webpack_require__(12);
class QueryOrderDto extends pagination_dto_1.PaginationDto {
}
exports.QueryOrderDto = QueryOrderDto;
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.OrderStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.OrderStatus),
    tslib_1.__metadata("design:type", typeof (_a = typeof client_1.OrderStatus !== "undefined" && client_1.OrderStatus) === "function" ? _a : Object)
], QueryOrderDto.prototype, "status", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.PaymentStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PaymentStatus),
    tslib_1.__metadata("design:type", typeof (_b = typeof client_1.PaymentStatus !== "undefined" && client_1.PaymentStatus) === "function" ? _b : Object)
], QueryOrderDto.prototype, "paymentStatus", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryOrderDto.prototype, "customerId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryOrderDto.prototype, "search", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    tslib_1.__metadata("design:type", String)
], QueryOrderDto.prototype, "startDate", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    tslib_1.__metadata("design:type", String)
], QueryOrderDto.prototype, "endDate", void 0);


/***/ }),
/* 59 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InventoryModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const inventory_controller_1 = __webpack_require__(60);
const inventory_service_1 = __webpack_require__(61);
const common_module_1 = __webpack_require__(10);
const auth_module_1 = __webpack_require__(19);
let InventoryModule = class InventoryModule {
};
exports.InventoryModule = InventoryModule;
exports.InventoryModule = InventoryModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [inventory_controller_1.InventoryController],
        providers: [inventory_service_1.InventoryService],
        exports: [inventory_service_1.InventoryService],
    })
], InventoryModule);


/***/ }),
/* 60 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InventoryController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const inventory_service_1 = __webpack_require__(61);
const adjust_inventory_dto_1 = __webpack_require__(62);
const roles_decorator_1 = __webpack_require__(35);
const current_user_decorator_1 = __webpack_require__(28);
const client_1 = __webpack_require__(12);
let InventoryController = class InventoryController {
    constructor(inventoryService) {
        this.inventoryService = inventoryService;
    }
    adjust(dto, user) {
        return this.inventoryService.adjust(dto, user?.sub);
    }
    getHistory(productId, query) {
        return this.inventoryService.getHistory(productId, query);
    }
};
exports.InventoryController = InventoryController;
tslib_1.__decorate([
    (0, common_1.Post)('adjust'),
    (0, swagger_1.ApiOperation)({ summary: 'Adjust inventory (admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Inventory adjusted' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Insufficient stock' }),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__param(1, (0, current_user_decorator_1.CurrentUser)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_b = typeof adjust_inventory_dto_1.AdjustInventoryDto !== "undefined" && adjust_inventory_dto_1.AdjustInventoryDto) === "function" ? _b : Object, typeof (_c = typeof current_user_decorator_1.AdminJwtPayload !== "undefined" && current_user_decorator_1.AdminJwtPayload) === "function" ? _c : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], InventoryController.prototype, "adjust", null);
tslib_1.__decorate([
    (0, common_1.Get)('history/:productId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get inventory history for product (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'productId', description: 'Product ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Inventory history' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Product not found' }),
    tslib_1.__param(0, (0, common_1.Param)('productId')),
    tslib_1.__param(1, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_d = typeof adjust_inventory_dto_1.QueryInventoryDto !== "undefined" && adjust_inventory_dto_1.QueryInventoryDto) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], InventoryController.prototype, "getHistory", null);
exports.InventoryController = InventoryController = tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiTags)('inventory'),
    (0, common_1.Controller)('inventory'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof inventory_service_1.InventoryService !== "undefined" && inventory_service_1.InventoryService) === "function" ? _a : Object])
], InventoryController);


/***/ }),
/* 61 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var InventoryService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InventoryService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
const client_1 = __webpack_require__(12);
let InventoryService = InventoryService_1 = class InventoryService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(InventoryService_1.name);
    }
    async adjust(dto, userId) {
        // Get product
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId, deletedAt: null },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${dto.productId} not found`);
        }
        // Get previous stock
        let previousStock = product.inventoryQuantity;
        if (dto.variantId) {
            const variant = await this.prisma.productVariant.findUnique({
                where: { id: dto.variantId, productId: dto.productId, isActive: true },
            });
            if (!variant) {
                throw new common_1.NotFoundException(`Variant with ID ${dto.variantId} not found`);
            }
            previousStock = variant.inventoryQuantity;
        }
        // Calculate quantity change based on movement type
        let quantityChange = dto.quantity;
        if (dto.type === client_1.MovementType.SALE || dto.type === client_1.MovementType.DAMAGE) {
            quantityChange = -Math.abs(dto.quantity);
        }
        else if (dto.type === client_1.MovementType.RETURN || dto.type === client_1.MovementType.PURCHASE) {
            quantityChange = Math.abs(dto.quantity);
        }
        // ADJUSTMENT and TRANSFER keep the original sign
        // Calculate new stock
        const newStock = previousStock + quantityChange;
        // Validate stock doesn't go negative
        if (newStock < 0) {
            throw new common_1.BadRequestException('Insufficient stock for this adjustment');
        }
        // Use transaction to update stock and create movement record
        const result = await this.prisma.$transaction(async (tx) => {
            // Update product stock
            if (dto.variantId) {
                await tx.productVariant.update({
                    where: { id: dto.variantId },
                    data: { inventoryQuantity: newStock },
                });
            }
            // Always update product stock
            await tx.product.update({
                where: { id: dto.productId },
                data: { inventoryQuantity: product.inventoryQuantity + quantityChange },
            });
            // Create inventory movement record
            const movement = await tx.inventoryMovement.create({
                data: {
                    productId: dto.productId,
                    variantId: dto.variantId,
                    type: dto.type,
                    quantity: quantityChange,
                    reason: dto.reason,
                    reference: dto.reference,
                    previousStock,
                    newStock,
                    notes: dto.notes,
                    userId,
                },
            });
            return movement;
        });
        this.logger.log(`Inventory adjusted for product ${product.sku}: ${previousStock} -> ${newStock} (${dto.type})`);
        return {
            message: 'Inventory adjusted successfully',
            previousStock,
            newStock,
            movement: result,
        };
    }
    async getHistory(productId, query) {
        // Verify product exists
        const product = await this.prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID ${productId} not found`);
        }
        const movements = await this.prisma.inventoryMovement.findMany({
            where: {
                productId,
                variantId: query?.variantId,
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return {
            product: {
                id: product.id,
                sku: product.sku,
                name: product.name,
                currentStock: product.inventoryQuantity,
            },
            movements,
        };
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = InventoryService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], InventoryService);


/***/ }),
/* 62 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueryInventoryDto = exports.AdjustInventoryDto = void 0;
const tslib_1 = __webpack_require__(1);
const class_validator_1 = __webpack_require__(26);
const swagger_1 = __webpack_require__(4);
const class_transformer_1 = __webpack_require__(41);
const client_1 = __webpack_require__(12);
class AdjustInventoryDto {
}
exports.AdjustInventoryDto = AdjustInventoryDto;
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], AdjustInventoryDto.prototype, "productId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], AdjustInventoryDto.prototype, "variantId", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.MovementType }),
    (0, class_validator_1.IsEnum)(client_1.MovementType),
    tslib_1.__metadata("design:type", typeof (_a = typeof client_1.MovementType !== "undefined" && client_1.MovementType) === "function" ? _a : Object)
], AdjustInventoryDto.prototype, "type", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    tslib_1.__metadata("design:type", Number)
], AdjustInventoryDto.prototype, "quantity", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], AdjustInventoryDto.prototype, "reason", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    tslib_1.__metadata("design:type", String)
], AdjustInventoryDto.prototype, "reference", void 0);
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    tslib_1.__metadata("design:type", String)
], AdjustInventoryDto.prototype, "notes", void 0);
class QueryInventoryDto {
}
exports.QueryInventoryDto = QueryInventoryDto;
tslib_1.__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String)
], QueryInventoryDto.prototype, "variantId", void 0);


/***/ }),
/* 63 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotificationsModule = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const notifications_controller_1 = __webpack_require__(64);
const notifications_service_1 = __webpack_require__(65);
const common_module_1 = __webpack_require__(10);
const auth_module_1 = __webpack_require__(19);
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [notifications_controller_1.NotificationsController],
        providers: [notifications_service_1.NotificationsService],
        exports: [notifications_service_1.NotificationsService],
    })
], NotificationsModule);


/***/ }),
/* 64 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotificationsController = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const swagger_1 = __webpack_require__(4);
const notifications_service_1 = __webpack_require__(65);
const public_decorator_1 = __webpack_require__(27);
const roles_decorator_1 = __webpack_require__(35);
const client_1 = __webpack_require__(12);
let NotificationsController = class NotificationsController {
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    generateWhatsAppLink(orderId) {
        return this.notificationsService.generateWhatsAppCheckoutLink(orderId);
    }
    generateConfirmation(orderId) {
        return this.notificationsService.generateOrderConfirmationMessage(orderId);
    }
    generateShippingNotification(orderId) {
        return this.notificationsService.generateShippingNotification(orderId);
    }
};
exports.NotificationsController = NotificationsController;
tslib_1.__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('whatsapp/:orderId'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate WhatsApp checkout link (public)' }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'WhatsApp URL and message' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    tslib_1.__param(0, (0, common_1.Param)('orderId')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], NotificationsController.prototype, "generateWhatsAppLink", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Get)('confirmation/:orderId'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Generate order confirmation message (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Confirmation message' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    tslib_1.__param(0, (0, common_1.Param)('orderId')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], NotificationsController.prototype, "generateConfirmation", null);
tslib_1.__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Get)('shipping/:orderId'),
    (0, roles_decorator_1.Roles)(client_1.AdminRole.SUPER_ADMIN, client_1.AdminRole.ADMIN, client_1.AdminRole.MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Generate shipping notification (admin)' }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: 'Order ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Shipping notification message' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'No tracking number' }),
    tslib_1.__param(0, (0, common_1.Param)('orderId')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], NotificationsController.prototype, "generateShippingNotification", null);
exports.NotificationsController = NotificationsController = tslib_1.__decorate([
    (0, swagger_1.ApiTags)('notifications'),
    (0, common_1.Controller)('notifications'),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof notifications_service_1.NotificationsService !== "undefined" && notifications_service_1.NotificationsService) === "function" ? _a : Object])
], NotificationsController);


/***/ }),
/* 65 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var NotificationsService_1;
var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NotificationsService = void 0;
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const prisma_service_1 = __webpack_require__(11);
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(NotificationsService_1.name);
    }
    async generateWhatsAppCheckoutLink(orderId) {
        // Get order details
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, sku: true, ownerName: true, ownerWhatsapp: true },
                        },
                    },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException(`Order with ID ${orderId} not found`);
        }
        // Get WhatsApp number - prefer product owner's WhatsApp for direct contact
        const firstProduct = order.items[0]?.product;
        const phoneNumber = firstProduct?.ownerWhatsapp || order.customerWhatsapp || order.customerPhone;
        if (!phoneNumber) {
            throw new common_1.BadRequestException('No WhatsApp number available for this order');
        }
        // Format phone number (remove non-digits)
        const formattedPhone = phoneNumber.replace(/\D/g, '');
        // Build message
        const items = order.items
            .map((item) => {
            const price = this.formatPrice(item.totalPrice);
            return `- ${item.productName} x${item.quantity} = Rp ${price}`;
        })
            .join('\n');
        const message = `Halo, saya ingin memesan:

📄 *Order ID:* ${order.orderNumber}

📦 *Item Pesanan:*
${items}

💰 *Subtotal:* Rp ${this.formatPrice(order.subtotal)}
🚚 *Ongkir:* Rp ${this.formatPrice(order.shippingCost)}
💸 *Total:* Rp ${this.formatPrice(order.total)}

👤 *Nama:* ${order.shippingName}
📱 *Telepon:* ${order.shippingPhone}
📍 *Alamat:*
${order.shippingAddress}
${order.shippingCity}, ${order.shippingProvince}
${order.shippingPostalCode}
${order.shippingCountry}

${order.customerNotes ? `📝 *Catatan:* ${order.customerNotes}` : ''}

Mohon konfirmasi pesanan saya. Terima kasih! 🙏`;
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
        // Mark as WhatsApp sent
        await this.prisma.order.update({
            where: { id: orderId },
            data: { whatsappSentAt: new Date() },
        });
        this.logger.log(`WhatsApp link generated for order: ${order.orderNumber}`);
        return { url, message };
    }
    async generateOrderConfirmationMessage(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { name: true },
                        },
                    },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException(`Order with ID ${orderId} not found`);
        }
        const items = order.items
            .map((item) => `- ${item.productName} x${item.quantity}`)
            .join('\n');
        const message = `✅ *Pesanan Dikonfirmasi!*

📄 *Order ID:* ${order.orderNumber}

📦 *Item:*
${items}

💰 *Total:* Rp ${this.formatPrice(order.total)}

Terima kasih telah berbelanja! 🙏`;
        return { message };
    }
    async generateShippingNotification(orderId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    select: { productName: true, quantity: true },
                },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException(`Order with ID ${orderId} not found`);
        }
        if (!order.trackingNumber) {
            throw new common_1.BadRequestException('Order does not have tracking number yet');
        }
        const message = `🚚 *Pesanan Dikirim!*

📄 *Order ID:* ${order.orderNumber}
📦 *Kurir:* ${order.shippingProvider || 'N/A'}
🔖 *No. Resi:* ${order.trackingNumber}

Lacak pengiriman Anda untuk melihat status terbaru.

Terima kasih! 🙏`;
        return { message };
    }
    formatPrice(price) {
        return price.toLocaleString('id-ID');
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = tslib_1.__decorate([
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof prisma_service_1.PrismaService !== "undefined" && prisma_service_1.PrismaService) === "function" ? _a : Object])
], NotificationsService);


/***/ }),
/* 66 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.uploadConfig = exports.whatsappConfig = exports.databaseConfig = exports.redisConfig = exports.jwtConfig = exports.appConfig = void 0;
const config_1 = __webpack_require__(5);
exports.appConfig = (0, config_1.registerAs)('app', () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.API_PORT || '3002', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
}));
exports.jwtConfig = (0, config_1.registerAs)('jwt', () => ({
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));
exports.redisConfig = (0, config_1.registerAs)('redis', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || undefined,
}));
exports.databaseConfig = (0, config_1.registerAs)('database', () => ({
    url: process.env.DATABASE_URL || 'file:../../db/ecommerce.db',
}));
exports.whatsappConfig = (0, config_1.registerAs)('whatsapp', () => ({
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    number: process.env.WHATSAPP_NUMBER || '+6281234567890',
}));
exports.uploadConfig = (0, config_1.registerAs)('upload', () => ({
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
}));


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

/**
 * E-Commerce API - Main Entry Point
 * NestJS Production-Ready REST API
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(1);
const common_1 = __webpack_require__(2);
const core_1 = __webpack_require__(3);
const swagger_1 = __webpack_require__(4);
const config_1 = __webpack_require__(5);
const helmet_1 = tslib_1.__importDefault(__webpack_require__(6));
const compression_1 = tslib_1.__importDefault(__webpack_require__(7));
const app_module_1 = __webpack_require__(8);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    // Get config service
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('app.port') || 3002;
    const nodeEnv = configService.get('app.nodeEnv') || 'development';
    // Security
    app.use((0, helmet_1.default)());
    app.use((0, compression_1.default)());
    // CORS
    app.enableCors({
        origin: configService.get('CORS_ORIGIN', '*'),
        credentials: true,
    });
    // Global prefix with versioning
    app.setGlobalPrefix('api/v1');
    app.enableVersioning({
        type: common_1.VersioningType.URI,
    });
    // Global validation pipe
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    // Swagger/OpenAPI
    if (nodeEnv !== 'production') {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('ShopNx E-Commerce API')
            .setDescription('Production-ready E-Commerce REST API with NestJS')
            .setVersion('1.0')
            .addBearerAuth()
            .addTag('auth', 'Authentication endpoints (Admin only)')
            .addTag('users', 'User management (Admin only)')
            .addTag('products', 'Product management')
            .addTag('categories', 'Category management')
            .addTag('orders', 'Order management')
            .addTag('inventory', 'Inventory management')
            .addTag('notifications', 'Notification services')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document, {
            swaggerOptions: {
                persistAuthorization: true,
            },
        });
        common_1.Logger.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
    }
    // Start server
    await app.listen(port);
    common_1.Logger.log(`🚀 API running on: http://localhost:${port}/api/v1`);
    common_1.Logger.log(`🌍 Environment: ${nodeEnv}`);
}
bootstrap();

})();

/******/ })()
;
//# sourceMappingURL=main.js.map