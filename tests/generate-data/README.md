# How to generate

## `invalid-map-column.js`

1. Create `src/invalid-map-column.ts` with content
```
console.log('goodbye cruel world');
console.log('goodbye man');
```
2. Run `tsc --inlineSourceMap src/invalid-map-column.ts --outFile ../data/invalid-map-column.js`
3. Save source map comment from `../data/invalid-map-column.js`
4. Replace `src/invalid-map-column.ts` content with
```
console.log('hello happy world');
console.log('hello man');
```
5. Run `.2` again
6. Replace source map comment of `../data/invalid-map-column.js` with one from `.3`

## `invalid-map-line.js`

1. Create `src/invalid-map-line.ts` with content
```
console.log('hello happy world');
console.log('hello man');
```
2. Run `tsc --inlineSourceMap src/invalid-map-line.ts --outFile ../data/invalid-map-line.js`
3. Save source map comment from `../data/invalid-map-line.js`
4. Replace `src/invalid-map-line.ts` content with
```
console.log('hello happy world');
```
5. Run `.2` again
6. Replace source map comment of `../data/invalid-map-line.js` with one from `.3`
