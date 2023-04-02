# Astro Interpreter

A little interpreter, using Ohm.

Language specification is [here](https://cs.lmu.edu/~ray/notes/astro/).

Example run:

```
$ node astro.js '
dozen = 5 + 8 - 1;
print(dozen ** 3 / sqrt(100));
print(sqrt(5.9 + hypot(π, 3.5e-8)));
'
172.8
3.0069241183624493
```
