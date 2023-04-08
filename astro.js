import * as ohm from "ohm-js"

const astroGrammar = ohm.grammar(String.raw`Astro {
  Program     = Statement+
  Statement   = id "=" Exp ";"                         --assignment
              | print Exp ";"                          --print
  Args        = ListOf<Exp, ",">
  Exp         = Exp ("+" | "-") Term                   --binary
              | Term
  Term        = Term ("*" | "/" | "%") Factor          --binary
              | Factor
  Factor      = Primary "**" Factor                    --binary
              | "-" Primary                            --negation
              | Primary
  Primary     = id "(" Args ")"                        --call
              | numeral                                --num
              | id                                     --id
              | "(" Exp ")"                            --parens

  numeral     = digit+ ("." digit+)? (("E" | "e") ("+" | "-")? digit+)?
  print       = "print" ~idchar
  idchar      = letter | digit | "_"
  id          = ~print letter idchar*
  space      += "//" (~"\n" any)*                      --comment
}`)

const memory = {
  π: { type: "NUM", value: Math.PI, access: "RO" },
  sin: { type: "FUNC", value: Math.sin, paramCount: 1 },
  cos: { type: "FUNC", value: Math.cos, paramCount: 1 },
  sqrt: { type: "FUNC", value: Math.sqrt, paramCount: 1 },
  hypot: { type: "FUNC", value: Math.hypot, paramCount: 2 },
}

function check(condition, message, at) {
  if (!condition) throw new Error(`${at.source.getLineAndColumnMessage()}${message}`)
}

const evaluator = astroGrammar.createSemantics().addOperation("eval", {
  Program(statements) {
    for (const statement of statements.children) statement.eval()
  },
  Statement_assignment(id, _eq, expression, _semicolon) {
    const entity = memory[id.sourceString]
    check(!entity || entity?.type === "NUM", "Cannot assign", id)
    check(!entity || entity?.access === "RW", `${id.sourceString} not writable`, id)
    memory[id.sourceString] = { type: "NUM", value: expression.eval(), access: "RW" }
  },
  Statement_print(_print, expression, _semicolon) {
    console.log(expression.eval())
  },
  Args(expList) {
    return expList.asIteration().children.map(e => e.eval())
  },
  Exp_binary(left, op, right) {
    const [x, y] = [left.eval(), right.eval()]
    return op.sourceString == "+" ? x + y : x - y
  },
  Term_binary(left, op, right) {
    const [x, o, y] = [left.eval(), op.sourceString, right.eval()]
    return o == "*" ? x * y : o == "/" ? x / y : x % y
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
    const entity = memory[id.sourceString]
    check(entity !== undefined, `${id.sourceString} not defined`, id)
    check(entity?.type === "NUM", `Expected type number`, id)
    return entity.value
  },
  Primary_call(id, _open, args, _close) {
    const [entity, argList] = [memory[id.sourceString], args.eval()]
    check(entity !== undefined, `${id.sourceString} not defined`, id)
    check(entity?.type === "FUNC", "Function expected", id)
    check(argList.length === entity?.paramCount, "Wrong number of arguments", args)
    return entity.value(...argList)
  },
})

try {
  const match = astroGrammar.match(process.argv[2])
  if (match.failed()) throw new Error(match.message)
  evaluator(match).eval()
} catch (e) {
  console.error(`${e}`)
}
