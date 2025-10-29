/**
 * Derivation Graph Builder
 *
 * Builds per-note derivation graphs by analyzing the AST.
 * NO MODIFICATIONS to core Crux library needed!
 *
 * Strategy:
 * 1. Parse the program to get AST
 * 2. Build environment map from Assign nodes
 * 3. Walk the final expression AST recursively
 * 4. For each operation, track how pips combine
 * 5. Generate DAG showing source pips → operations → final notes
 */

/**
 * A node in the derivation graph
 */
class DerivationNode {
  constructor(type, data = {}) {
    this.id = generateNodeId();
    this.type = type; // 'source-pip', 'operator', 'ref', 'final-note'
    this.data = data;
    this.children = []; // Child nodes in the DAG
  }

  addChild(node) {
    this.children.push(node);
  }
}

let _nodeIdCounter = 0;
function generateNodeId() {
  return `node_${_nodeIdCounter++}`;
}

/**
 * Main derivation graph builder
 */
class DerivationGraphBuilder {
  constructor(sourceCode, golden) {
    this.sourceCode = sourceCode;
    this.golden = golden;
    this.ast = null;
    this.environment = new Map(); // variable name → AST expression
    this.evaluatedEnv = new Map(); // variable name → evaluated Mot
  }

  /**
   * Build the complete derivation graph
   */
  build() {
    // Parse to get AST
    this.ast = this.golden.parse(this.sourceCode);

    // Build environment from assignments
    this.buildEnvironment();

    // Evaluate to get final result
    const result = this.golden.crux_interp(this.sourceCode);
    const finalMot = result.sections && result.sections.length > 0
      ? result.sections[result.sections.length - 1]
      : result;

    // Find the final expression in the AST
    const finalExpr = this.getFinalExpression();

    // Build derivation for each final pip
    const pipDerivations = [];
    if (finalMot && finalMot.values) {
      const finalPips = finalMot.values.filter(v => v.step !== undefined);

      // For each final pip, trace back through the AST
      finalPips.forEach((pip, index) => {
        const derivation = this.traceDerivation(finalExpr, index);
        pipDerivations.push({
          index,
          pip,
          derivation
        });
      });
    }

    return {
      finalMot,
      pipDerivations,
      environment: this.environment,
      evaluatedEnv: this.evaluatedEnv
    };
  }

  /**
   * Build environment map from AST
   */
  buildEnvironment() {
    if (!this.ast || !this.ast.sections) return;

    for (const stmts of this.ast.sections) {
      for (const stmt of stmts) {
        // Check if it's an assignment (has name and expr)
        if (stmt && stmt.name && stmt.expr) {
          this.environment.set(stmt.name, stmt.expr);

          // Also evaluate and store the result
          try {
            const env = new Map();
            // Build up environment for evaluation
            for (const [name, expr] of this.environment.entries()) {
              if (name !== stmt.name) {
                env.set(name, expr.eval ? expr.eval(env) : expr);
              }
            }
            const value = stmt.expr.eval ? stmt.expr.eval(env) : stmt.expr;
            this.evaluatedEnv.set(stmt.name, value);
          } catch (e) {
            // Evaluation might fail if dependencies aren't ready yet
            console.warn(`Could not evaluate ${stmt.name}:`, e.message);
          }
        }
      }
    }
  }

  /**
   * Get the final expression from the AST
   */
  getFinalExpression() {
    if (!this.ast || !this.ast.sections || this.ast.sections.length === 0) {
      return null;
    }

    const lastSection = this.ast.sections[this.ast.sections.length - 1];
    if (lastSection.length === 0) return null;

    const lastStmt = lastSection[lastSection.length - 1];

    // If it's an assignment, return the expression
    if (lastStmt.expr) return lastStmt.expr;

    // Otherwise it's the expression itself
    return lastStmt;
  }

  /**
   * Trace derivation for a specific pip index in the final result
   * This is the key function that builds the derivation DAG
   */
  traceDerivation(expr, targetIndex) {
    if (!expr) {
      return new DerivationNode('unknown', { message: 'No expression' });
    }

    const exprType = expr.constructor ? expr.constructor.name : 'unknown';

    // Handle Ref (variable reference)
    if (exprType === 'Ref') {
      const refName = expr.name;
      const refExpr = this.environment.get(refName);
      const node = new DerivationNode('ref', {
        varName: refName,
        exprType
      });

      if (refExpr) {
        node.addChild(this.traceDerivation(refExpr, targetIndex));
      }

      return node;
    }

    // Handle Mot (literal values)
    if (exprType === 'Mot') {
      const pips = expr.values.filter(v => v && v.step !== undefined);
      if (targetIndex < pips.length) {
        const pip = pips[targetIndex];
        return new DerivationNode('source-pip', {
          step: pip.step,
          timeScale: pip.timeScale,
          tag: pip.tag,
          index: targetIndex
        });
      }
      return new DerivationNode('source-pip', { message: 'Out of range' });
    }

    // Handle FollowedBy (concatenation)
    if (exprType === 'FollowedBy') {
      const node = new DerivationNode('operator', {
        operation: 'concat',
        symbol: ','
      });

      // Need to figure out which side the target pip came from
      const leftMot = this.evaluateExpr(expr.x);
      const leftCount = leftMot && leftMot.values ? leftMot.values.length : 0;

      if (targetIndex < leftCount) {
        // Comes from left side
        node.addChild(this.traceDerivation(expr.x, targetIndex));
      } else {
        // Comes from right side
        node.addChild(this.traceDerivation(expr.y, targetIndex - leftCount));
      }

      return node;
    }

    // Handle Mul (fan multiply: each RHS applied to all LHS)
    if (exprType === 'Mul') {
      const node = new DerivationNode('operator', {
        operation: 'mul',
        symbol: '*',
        semantics: 'fan'
      });

      // In fan multiply: result[i] = LHS[i % |LHS|] mul RHS[floor(i / |LHS|)]
      const leftMot = this.evaluateExpr(expr.x);
      const rightMot = this.evaluateExpr(expr.y);

      const leftCount = leftMot && leftMot.values ? leftMot.values.length : 1;
      const rightCount = rightMot && rightMot.values ? rightMot.values.length : 1;

      const leftIdx = targetIndex % leftCount;
      const rightIdx = Math.floor(targetIndex / leftCount);

      node.addChild(this.traceDerivation(expr.x, leftIdx));
      node.addChild(this.traceDerivation(expr.y, rightIdx));

      return node;
    }

    // Handle Dot (cog multiply: tiled pairing)
    if (exprType === 'Dot') {
      const node = new DerivationNode('operator', {
        operation: 'dot',
        symbol: '.*',
        semantics: 'cog'
      });

      // In cog multiply: result[i] = LHS[i] mul RHS[i % |RHS|]
      const rightMot = this.evaluateExpr(expr.y);
      const rightCount = rightMot && rightMot.values ? rightMot.values.length : 1;

      const leftIdx = targetIndex;
      const rightIdx = targetIndex % rightCount;

      node.addChild(this.traceDerivation(expr.x, leftIdx));
      node.addChild(this.traceDerivation(expr.y, rightIdx));

      return node;
    }

    // Handle Expand (^)
    if (exprType === 'Expand') {
      const node = new DerivationNode('operator', {
        operation: 'expand',
        symbol: '^',
        semantics: 'fan'
      });

      const leftMot = this.evaluateExpr(expr.x);
      const leftCount = leftMot && leftMot.values ? leftMot.values.length : 1;

      const leftIdx = targetIndex % leftCount;
      const rightIdx = Math.floor(targetIndex / leftCount);

      node.addChild(this.traceDerivation(expr.x, leftIdx));
      node.addChild(this.traceDerivation(expr.y, rightIdx));

      return node;
    }

    // Handle other operators similarly...
    // For now, return a generic operator node
    return new DerivationNode('operator', {
      operation: exprType.toLowerCase(),
      message: `Unhandled operator: ${exprType}`
    });
  }

  /**
   * Evaluate an expression to get its Mot result
   */
  evaluateExpr(expr) {
    if (!expr) return null;

    try {
      // Build evaluation environment
      const env = new Map();
      for (const [name, value] of this.evaluatedEnv.entries()) {
        env.set(name, value);
      }

      return expr.eval ? expr.eval(env) : expr;
    } catch (e) {
      console.warn('Could not evaluate expression:', e.message);
      return null;
    }
  }

  /**
   * Convert derivation tree to DAG structure for visualization
   */
  static treeToDAG(node, visited = new Set()) {
    if (!node || visited.has(node.id)) {
      return { nodes: [], edges: [] };
    }

    visited.add(node.id);

    const nodes = [{
      id: node.id,
      type: node.type,
      data: node.data
    }];

    const edges = [];

    for (const child of node.children) {
      const childDAG = DerivationGraphBuilder.treeToDAG(child, visited);
      nodes.push(...childDAG.nodes);
      edges.push(...childDAG.edges);

      edges.push({
        from: child.id,
        to: node.id
      });
    }

    return { nodes, edges };
  }
}

export { DerivationGraphBuilder, DerivationNode };
