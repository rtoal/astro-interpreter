import ohm from "ohm-js"

const astroGrammar = ohm.grammar(String.raw`Astro {
  Program     = Statement+
  Statement   = id "=" Exp ";"                     --assignment
              | id Args ";"                        --call
  Args        = "(" ListOf<Exp, ","> ")"
  Exp         = Exp ("+" | "-") Term               --binary
              | Term
  Term        = Term (~"**" "*" | "/") Factor      --binary
              | Factor
  Factor      = Primary "**" Factor                --binary
              | Primary
  Primary     = id Args                            --call
              | numeral                            --num
              | id                                 --id
              | "(" Exp ")"                        --parens

  numeral     = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  id          = letter (letter | digit | "_")*
  space      += "//" (~"\n" any)*                  --comment
}`)

const source = `dozen = 5 + 8 - 1;
  print(dozen ** 3 / sqrt(100));
  print(sqrt(5.9 + hypot(π, 3.5e-8)));
`

const memory = {
  π: { type: "NUM", value: Math.PI, access: "RO" },
  sin: { type: "FUNC", value: Math.sin, paramCount: 1 },
  cos: { type: "FUNC", value: Math.cos, paramCount: 1 },
  sqrt: { type: "FUNC", value: Math.sqrt, paramCount: 1 },
  hypot: { type: "FUNC", value: Math.hypot, paramCount: 2 },
  print: { type: "PROC", value: args => console.log(args), paramCount: 1 },
}

function check(condition, message, node) {
  if (!condition) throw new Error(`${node.source.getLineAndColumnMessage()}${message}`)
}

const semantics = astroGrammar.createSemantics().addOperation("eval", {
  Program(statements) {
    statements.eval()
  },
  Statement_assignment(id, _eq, e, _semicolon) {
    const entity = memory[id.sourceString]
    check(!entity || entity?.type === "NUM", "Cannot assign", id)
    check(!entity || entity?.access === "RW", `${id.sourceString} not writable`, id)
    memory[id.sourceString] = { type: "NUM", value: e.eval(), access: "RW" }
  },
  Statement_call(id, args, _semicolon) {
    const [entity, argList] = [memory[id.sourceString], args.eval()]
    check(entity !== undefined, `${id.sourceString} not defined`, id)
    check(entity?.type === "PROC", "Procedure expected", id)
    check(argList.length === entity?.paramCount, "Wrong number of arguments", args)
    entity.value(...argList)
  },
  Args(_leftParen, expressions, _rightParen) {
    return expressions.asIteration().eval()
  },
  Exp_binary(left, op, right) {
    const [x, y] = [left.eval(), right.eval()]
    return op.sourceString == "+" ? x + y : x - y
  },
  Term_binary(left, op, right) {
    const [x, y] = [left.eval(), right.eval()]
    return op.sourceString == "*" ? x * y : x / y
  },
  Factor_binary(left, _op, right) {
    return left.eval() ** right.eval()
  },
  Primary_parens(_leftParen, e, _rightParen) {
    return e.eval()
  },
  Primary_num(num) {
    return Number(num.sourceString)
  },
  Primary_id(id) {
    // In Astro, functions and procedures never stand alone
    const entity = memory[id.sourceString]
    check(entity !== undefined, `${id.sourceString} not defined`, id)
    check(entity?.type === "NUM", `Expected type number`, id)
    return entity.value
  },
  Primary_call(id, args) {
    const [entity, argList] = [memory[id.sourceString], args.eval()]
    check(entity !== undefined, `${id.sourceString} not defined`, id)
    check(entity?.type === "FUNC", "Function expected", id)
    check(argList.length === entity?.paramCount, "Wrong number of arguments", args)
    return entity.value(...argList)
  },
  _iter(...nodes) {
    return nodes.map(node => node.eval())
  },
})

try {
  const match = astroGrammar.match(source)
  if (match.failed()) throw new Error(match.message)
  semantics(match).eval()
} catch (e) {
  console.error(`${e}`)
}
