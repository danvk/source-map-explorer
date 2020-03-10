var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, privateMap, value) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to set private field on non-instance");
    }
    privateMap.set(receiver, value);
    return value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, privateMap) {
    if (!privateMap.has(receiver)) {
        throw new TypeError("attempted to get private field on non-instance");
    }
    return privateMap.get(receiver);
};
var _a, _b;
var Work = (function () {
    function Work(a, b) {
        _a.set(this, void 0);
        _b.set(this, void 0);
        __classPrivateFieldSet(this, _a, a);
        __classPrivateFieldSet(this, _b, b);
    }
    Work.prototype.doWork = function () {
        console.log("Done work with \"" + __classPrivateFieldGet(this, _a) + "\" and \"" + __classPrivateFieldGet(this, _b) + "\"");
    };
    Work.prototype.doAsyncWork = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_c) {
                return [2, "Done work with \"" + __classPrivateFieldGet(this, _a) + "\" and \"" + __classPrivateFieldGet(this, _b) + "\""];
            });
        });
    };
    return Work;
}());
_a = new WeakMap(), _b = new WeakMap();
var work = new Work('🚧', 4);
work.doWork();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2l0aC11bm1hcHBlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2dlbmVyYXRlLWRhdGEvc3JjL3dpdGgtdW5tYXBwZWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtJQUlFLGNBQVksQ0FBUyxFQUFFLENBQVM7UUFIaEMscUJBQVc7UUFDWCxxQkFBVztRQUdULHVCQUFBLElBQUksTUFBTSxDQUFDLEVBQUM7UUFDWix1QkFBQSxJQUFJLE1BQU0sQ0FBQyxFQUFDO0lBQ2QsQ0FBQztJQUVELHFCQUFNLEdBQU47UUFDRSxPQUFPLENBQUMsR0FBRyxDQUFDLDhHQUE4QyxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVLLDBCQUFXLEdBQWpCOzs7Z0JBQ0UsV0FBTyw4R0FBOEMsRUFBQTs7O0tBQ3REO0lBQ0gsV0FBQztBQUFELENBQUMsQUFoQkQsSUFnQkM7O0FBRUQsSUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBRS9CLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImNsYXNzIFdvcmsge1xuICAjYTogc3RyaW5nO1xuICAjYjogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKGE6IHN0cmluZywgYjogbnVtYmVyKSB7XG4gICAgdGhpcy4jYSA9IGE7XG4gICAgdGhpcy4jYiA9IGI7XG4gIH1cblxuICBkb1dvcmsoKSB7XG4gICAgY29uc29sZS5sb2coYERvbmUgd29yayB3aXRoIFwiJHt0aGlzLiNhfVwiIGFuZCBcIiR7dGhpcy4jYn1cImApO1xuICB9XG5cbiAgYXN5bmMgZG9Bc3luY1dvcmsoKSB7XG4gICAgcmV0dXJuIGBEb25lIHdvcmsgd2l0aCBcIiR7dGhpcy4jYX1cIiBhbmQgXCIke3RoaXMuI2J9XCJgXG4gIH1cbn1cblxuY29uc3Qgd29yayA9IG5ldyBXb3JrKCfwn5qnJywgNCk7XG5cbndvcmsuZG9Xb3JrKCk7XG4iXX0=