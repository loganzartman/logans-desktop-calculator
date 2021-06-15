# Logan's Desktop Calculator
*Not your regular four-function*
![image](https://user-images.githubusercontent.com/3401573/119804614-5c20f380-be95-11eb-99c5-d368c4a85267.png "Fibonacci")

## Syntax
```
// a comment

// add the number 2 to the stack
2

// add the booleans true and false to the stack
true false

// add the string "hello" to the stack in three different ways.
"hello" (hello) 'hello

// strings can be evaluated as code with `eval`.
// (parentheses strings) are easily nestable and typically used to store code.
// they also interact with local names—see the later section.
(2 2 +) eval  // 4

// [spooky] if a word doesn't parse as anything else (operator or literal), it's considered a string
hello

// apply the built-in plus operator to the two 2s on top of the stack
2 2 +

// to pass an operator as an argument, it must be encoded as a string
1 2 3 '+ map

// create a "local" name
// all occurrences of @name are replaced with a unique string each time the code is evaluated
@x                      // @x@0
(@y @y) eval            // @y@1 @y@1
'get-z 0 (@z) define-op
get-z get-z             // @z@2 @z@3

// locals are substituted into parentheses-strings if they are referenced outside them
@x (@x)   // @x@0 @x@0
(@y)      // @y
(@y) eval // @y@1
```
that's pretty much the whole grammar

## Sample programs
### Two and two
```
2 2 +
```
*4*

### Circle area 
```
3 'radius store
// do other things
'radius load 2 ^ 3.141 * 
```
*28.269*

### Map-reduce with builtins
```
'square 1 (2 ^) define-op // create an operator that squares a number
0 10 1 range              // 0 through 9, step size 1
'square map               // 0 1 4 9 16 ...
'+ reduce
```
*285*

### Fibonacci
```
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
```
1 2 3 pack 'stack store
5 6 clear
'stack load eval
7 8
```
*8 7 3 2 1*

### Implementing block scoping
```
(
  // implements ++ and -- on a counter
  0 @c store
  @scope 0 (@c load dup 1 + @c store) define-op
  @unscope 0 (@c load 1 - dup @c store) define-op

  // implement brackets as operators that save and load the stack
  '{ 0 (pack 'stack- @scope + store) define-op
  '} 0 (
    pack @temp store 
    'stack- @unscope + load eval 
    @temp load eval
    @temp delete
  ) define-op
) eval // this basically "namespaces" all the local names

2 2 '+ reduce { 1 2 '+ reduce } -
```

### Anonymous operators
```
// accepts a code string and returns an operator name
fn 1 (
  // insert name and arity before the code argument
  @fn swap 'none swap define-op
  (@fn) // quote the operator name to avoid invoking it
) define-op

1 2 3 (2 ^) fn map
```
*9 4 1*

### Run Javascript
this is also a bit spooky:
```C
// load the value of Math.PI onto the stack
(Math.PI) js

// compute the sin of pi
(Math.PI) js (Math.sin(this.pop())) js

// put two things on the stack
(this.push(1); this.push(2)) js
```

### Implement a `repeat` keyword
```
'repeat 2 (
  @n store @code store
  (@n load 0 >)
  (
    @code load eval
    @code load @n load 1 - repeat
  )
  () if
  @n delete @code delete
) define-op

('hello) 5 repeat
(pop) 2 repeat
```
*hello hello hello*

### Infix interpreter (very basic)
```
typeof 1 ((typeof this.pop()) js) define-op
0 'stid store
stack-save 0 (pack 'stid load dup 1 + 'stid store 'st- swap + store) define-op
stack-restore 0 ('stid load 1 - dup 'stid store 'st- swap + load eval) define-op

i 1 (
  @expr store
  '_ @op store
  stack-save
  @fn 1 (
    dup (typeof 'string ==)
    (@op store)
    (
      (@op load '_ ==)
      ()
      (@op load eval)
      if
    )
    if
  ) define-op
  @expr load eval
  (@fn) map @result store
  stack-restore
  @result load
) define-op

(2 '+ 3 '+ 20 '* 5 '* (1 '+ 1) i) i
```
*250* (no operator precedence)
