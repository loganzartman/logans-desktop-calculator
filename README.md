# Logan's Desktop Calculator
*Not your regular four-function*
![Fibonacci Program](fib_promo.png "Fibonacci")

## Sample programs
### Two and two
```C
2 2 +
```
*4*

### Circle area 
```C
3 "radius" store
// do other things
2 "radius" load ^ 3.141 * 
```
*28.269*

### Map-reduce
```C
"square" 1 "2 swap ^" define-op // create an operator that squares a number
1 10 0 range                    // 0 through 9, step size 1
"square" map                    // 0 1 4 9 16 ...
"+" reduce
```
*285*

### Fibonacci
```C
"fib" 1 "
  dup
  'dup 2 swap - fib
   swap 1 swap - fib +'
  ''
  '2 swap <' if
" define-op

9 fib
```
*34*

### Work with the whole stack
```C
"+space" 2 "swap ' ' swap + +" define-op
"eat" 2 "pop" define-op
"save-stack" 1 "
  '_name' store
  '+space' reduce
  '_name' load store
  '_name' delete
" define-op
"load-stack" 1 "load eval" define-op
"clear-stack" 0 "'eat' reduce pop" define-op

1 2 3 "stack" save-stack
5 6 clear-stack
"stack" load-stack
```
