import * as ohm from "ohm-js"
import * as fs from "fs"

const astroGrammar = ohm.grammar(fs.readFileSync("astro.ohm"))

const memory = {
  π: { type: "NUM", value: Math.PI, mutable: false },
  sin: { type: "FUNC", fun: Math.sin, paramCount: 1 },
  cos: { type: "FUNC", fun: Math.cos, paramCount: 1 },
  sqrt: { type: "FUNC", fun: Math.sqrt, paramCount: 1 },
  hypot: { type: "FUNC", fun: Math.hypot, paramCount: 2 },
}

function must(condition, message, at) {
  if (!condition) throw new Error(`${at.source.getLineAndColumnMessage()}${message}`)
}

const evaluator = astroGrammar.createSemantics().addOperation("eval", {
  Program(statements) {
    for (const statement of statements.children) statement.eval()
  },
  Statement_assignment(id, _eq, expression, _semicolon) {
    const entity = memory[id.sourceString]
    must(!entity || entity?.type === "NUM", "Cannot assign", id)
    must(!entity || entity?.mutable, `${id.sourceString} not writable`, id)
    memory[id.sourceString] = { type: "NUM", value: expression.eval(), mutable: true }
  },
  Statement_print(_print, expression, _semicolon) {
    console.log(expression.eval())
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
    must(entity !== undefined, `${id.sourceString} not defined`, id)
    must(entity?.type === "NUM", `Expected type number`, id)
    return entity.value
  },
  Primary_call(id, _open, exps, _close) {
    const entity = memory[id.sourceString]
    must(entity !== undefined, `${id.sourceString} not defined`, id)
    must(entity?.type === "FUNC", "Function expected", id)
    const args = exps.asIteration().children.map(e => e.eval())
    must(args.length === entity?.paramCount, "Wrong number of arguments", exps)
    return entity.fun(...args)
  },
})

try {
  const match = astroGrammar.match(process.argv[2])
  if (match.failed()) throw new Error(match.message)
  evaluator(match).eval()
} catch (e) {
  console.error(`${e}`)
}
