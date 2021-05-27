# Logan's Desktop Calculator
*Not your regular four-function*
![image](https://user-images.githubusercontent.com/3401573/119804614-5c20f380-be95-11eb-99c5-d368c4a85267.png "Fibonacci")

## Sample programs
### Two and two
```C
2 2 +
```
*4*

### Circle area 
```C
3 (radius) store
// do other things
(radius) load 2 ^ 3.141 * 
```
*28.269*

### Map-reduce with builtins
```C
(square) 1 (2 ^) define-op // create an operator that squares a number
0 10 1 range                    // 0 through 9, step size 1
(square) map                    // 0 1 4 9 16 ...
(+) reduce
```
*285*

### Fibonacci
```C
fib 1 (
  dup (2 <)
  () // base case
  (
    dup
    1 - fib swap 
    2 - fib
    +
  )
  if
) define-op

9 fib
```
*34*

### Working with the whole stack
```C
clear-stack 0 ((pop) map) define-op

1 2 3 pack (stack) store
5 6 clear-stack
(stack) load eval
```

### Implementing block scoping
```C
// implement increment- and decrement-and-return for a counter
0 _c store
_scope 0 (_c load dup 1 + _c store) define-op
_unscope 0 (_c load 1 - dup _c store) define-op

// implement brackets as operators that save and load the stack
{ 0 (pack _stack _scope + store) define-op
} 0 (pack _temp store _stack _unscope + load eval _temp load eval) define-op

2 2 (+) reduce { 1 2 (+) reduce } -
```

### Anonymous operators
```C
0 _uuid_counter store
uuid 0 (_uuid_counter load dup 1 + _uuid_counter store $$ swap +) define-op

n-op 1 (
  _arity store            // save first arg
  uuid dup _id store      // generate name for op
  swap _arity load swap   // reorder args for define-op
  define-op               // define 'anonymous' op
  _id load                // return generated name
  _id _arity delete delete
) define-op
unop 1 (1 n-op) define-op
binop 1 (2 n-op) define-op

1 2 3 (2 ^) unop map
```
*9 4 1*
