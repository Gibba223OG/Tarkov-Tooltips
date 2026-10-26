import QtQuick

// Same bullet silhouette path as the existing SVG in Tooltip.tsx.
Canvas {
    id: bullet
    property color tint: "#45F165"
    onTintChanged: requestPaint()
    onWidthChanged: requestPaint()
    onHeightChanged: requestPaint()
    onPaint: {
        const ctx = getContext("2d")
        ctx.reset()
        ctx.scale(width / 24, height / 54)
        ctx.fillStyle = tint
        ctx.beginPath()
        ctx.moveTo(12,0.8)
        ctx.bezierCurveTo(10.7,2.1,9.2,4.6,8.3,8)
        ctx.lineTo(7.8,12.1)
        ctx.quadraticCurveTo(7.7,13.2,8.8,13.2)
        ctx.lineTo(15.2,13.2)
        ctx.quadraticCurveTo(16.3,13.2,16.2,12.1)
        ctx.lineTo(15.7,8)
        ctx.bezierCurveTo(14.8,4.6,13.3,2.1,12,0.8)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(8.9,14.4)
        ctx.lineTo(15.1,14.4)
        ctx.lineTo(16,17.1)
        ctx.lineTo(17,19.2)
        ctx.lineTo(17,41.1)
        ctx.quadraticCurveTo(17,42.7,15.4,42.7)
        ctx.lineTo(8.6,42.7)
        ctx.quadraticCurveTo(7,42.7,7,41.1)
        ctx.lineTo(7,19.2)
        ctx.lineTo(8,17.1)
        ctx.closePath()
        ctx.fill()
        ctx.fillRect(6.4,43.6,11.2,2.2)
    }
}
