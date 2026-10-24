import SwiftUI

// The kind glyphs and icons are SVG path data on a 16-unit grid (packages/ui tokens). This draws them:
// M L H V C S A Z, absolute and relative. Arcs become cubic curves.
struct SVGPath: Shape {
  let d: String

  func path(in rect: CGRect) -> Path {
    var p = Path()
    let s = rect.width / 16
    var cur = CGPoint.zero, start = CGPoint.zero, lastCtrl: CGPoint?
    let tokens = SVGPath.tokenize(d)
    var i = 0
    var cmd: Character = "M"
    func num() -> CGFloat { defer { i += 1 }; return CGFloat(Double(tokens[i]) ?? 0) }
    func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x * s, y: y * s) }
    while i < tokens.count {
      if let c = tokens[i].first, c.isLetter { cmd = c; i += 1 }
      let rel = cmd.isLowercase
      let base = rel ? cur : .zero
      switch cmd.uppercased() {
      case "M":
        cur = CGPoint(x: base.x + num(), y: base.y + num()); start = cur
        p.move(to: pt(cur.x, cur.y)); cmd = rel ? "l" : "L"; lastCtrl = nil
      case "L":
        cur = CGPoint(x: base.x + num(), y: base.y + num()); p.addLine(to: pt(cur.x, cur.y)); lastCtrl = nil
      case "H":
        cur.x = (rel ? cur.x : 0) + num(); p.addLine(to: pt(cur.x, cur.y)); lastCtrl = nil
      case "V":
        cur.y = (rel ? cur.y : 0) + num(); p.addLine(to: pt(cur.x, cur.y)); lastCtrl = nil
      case "C":
        let c1 = CGPoint(x: base.x + num(), y: base.y + num()), c2 = CGPoint(x: base.x + num(), y: base.y + num())
        cur = CGPoint(x: base.x + num(), y: base.y + num())
        p.addCurve(to: pt(cur.x, cur.y), control1: pt(c1.x, c1.y), control2: pt(c2.x, c2.y)); lastCtrl = c2
      case "S":
        let c1 = lastCtrl.map { CGPoint(x: 2 * cur.x - $0.x, y: 2 * cur.y - $0.y) } ?? cur
        let c2 = CGPoint(x: base.x + num(), y: base.y + num())
        cur = CGPoint(x: base.x + num(), y: base.y + num())
        p.addCurve(to: pt(cur.x, cur.y), control1: pt(c1.x, c1.y), control2: pt(c2.x, c2.y)); lastCtrl = c2
      case "A":
        let rx = num(), ry = num(), rot = num(), large = num() != 0, sweep = num() != 0
        let end = CGPoint(x: base.x + num(), y: base.y + num())
        for (c1, c2, to) in SVGPath.arc(from: cur, to: end, rx: rx, ry: ry, rotation: rot, large: large, sweep: sweep) {
          p.addCurve(to: pt(to.x, to.y), control1: pt(c1.x, c1.y), control2: pt(c2.x, c2.y))
        }
        cur = end; lastCtrl = nil
      case "Z":
        p.closeSubpath(); cur = start; lastCtrl = nil
      default:
        i += 1
      }
    }
    return p
  }

  static func tokenize(_ d: String) -> [String] {
    var out: [String] = [], numStr = ""
    func flush() { if !numStr.isEmpty { out.append(numStr); numStr = "" } }
    for c in d {
      if c.isLetter && c != "e" { flush(); out.append(String(c)) }
      else if c == "-" && !numStr.isEmpty && numStr.last != "e" { flush(); numStr = "-" }
      else if c == "." && numStr.contains(".") { flush(); numStr = "." }
      else if c == "," || c == " " { flush() }
      else { numStr.append(c) }
    }
    flush()
    return out
  }

  // Endpoint arc to centre form, then up to four cubic segments (each at most 90 degrees).
  static func arc(from p1: CGPoint, to p2: CGPoint, rx rx0: CGFloat, ry ry0: CGFloat, rotation: CGFloat, large: Bool, sweep: Bool) -> [(CGPoint, CGPoint, CGPoint)] {
    if p1 == p2 || rx0 == 0 || ry0 == 0 { return [(p1, p2, p2)] }
    let phi = rotation * .pi / 180, cosP = cos(phi), sinP = sin(phi)
    let dx = (p1.x - p2.x) / 2, dy = (p1.y - p2.y) / 2
    let x1 = cosP * dx + sinP * dy, y1 = -sinP * dx + cosP * dy
    var rx = abs(rx0), ry = abs(ry0)
    let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
    if lambda > 1 { rx *= sqrt(lambda); ry *= sqrt(lambda) }
    let num = max(0, rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1)
    var coef = sqrt(num / (rx * rx * y1 * y1 + ry * ry * x1 * x1))
    if large == sweep { coef = -coef }
    let cx1 = coef * rx * y1 / ry, cy1 = -coef * ry * x1 / rx
    let cx = cosP * cx1 - sinP * cy1 + (p1.x + p2.x) / 2, cy = sinP * cx1 + cosP * cy1 + (p1.y + p2.y) / 2
    func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
      let a = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
      return a
    }
    let t1 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
    var dt = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
    if !sweep && dt > 0 { dt -= 2 * .pi } else if sweep && dt < 0 { dt += 2 * .pi }
    let segments = Int(ceil(abs(dt) / (.pi / 2)))
    let step = dt / CGFloat(segments), k = 4 / 3 * tan(step / 4)
    func point(_ t: CGFloat) -> CGPoint {
      CGPoint(x: cx + rx * cos(t) * cosP - ry * sin(t) * sinP, y: cy + rx * cos(t) * sinP + ry * sin(t) * cosP)
    }
    func deriv(_ t: CGFloat) -> CGPoint {
      CGPoint(x: -rx * sin(t) * cosP - ry * cos(t) * sinP, y: -rx * sin(t) * sinP + ry * cos(t) * cosP)
    }
    var out: [(CGPoint, CGPoint, CGPoint)] = []
    var t = t1
    for _ in 0..<segments {
      let a = point(t), b = point(t + step), da = deriv(t), db = deriv(t + step)
      out.append((CGPoint(x: a.x + k * da.x, y: a.y + k * da.y), CGPoint(x: b.x - k * db.x, y: b.y - k * db.y), b))
      t += step
    }
    return out
  }
}
