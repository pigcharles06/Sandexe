// Basic Complex Number Implementation (for demonstration)
// Using a dedicated library like 'complex.js' is recommended for real projects.
class Complex {
    constructor(re = 0, im = 0) {
        this.re = re;
        this.im = im;
    }

    add(other) {
        if (typeof other === 'number') {
            return new Complex(this.re + other, this.im);
        }
        return new Complex(this.re + other.re, this.im + other.im);
    }

    sub(other) {
         if (typeof other === 'number') {
            return new Complex(this.re - other, this.im);
        }
        return new Complex(this.re - other.re, this.im - other.im);
    }

    mul(other) {
        if (typeof other === 'number') {
            return new Complex(this.re * other, this.im * other);
        }
        const re = this.re * other.re - this.im * other.im;
        const im = this.re * other.im + this.im * other.re;
        return new Complex(re, im);
    }

    div(other) {
         if (typeof other === 'number') {
             if(other === 0) throw new Error("Division by zero");
             return new Complex(this.re / other, this.im / other);
         }
        const denominator = other.re * other.re + other.im * other.im;
         if (denominator === 0) throw new Error("Division by zero");
        const re = (this.re * other.re + this.im * other.im) / denominator;
        const im = (this.im * other.re - this.re * other.im) / denominator;
        return new Complex(re, im);
    }

    abs() {
        return Math.sqrt(this.re * this.re + this.im * this.im);
    }

    magnitude() { // Alias for abs()
         return this.abs();
    }

    static pow(base, exponent) {
        if(typeof base === 'number') base = new Complex(base);
         if (typeof exponent === 'number') {
             // Simple case: integer power or real power using polar form
             if(Number.isInteger(exponent) && exponent >= 0){
                 let result = new Complex(1);
                 for(let i = 0; i < exponent; i++){
                     result = result.mul(base);
                 }
                 return result;
             } else {
                 // More general case (using polar form, requires atan2 etc.)
                 // Simplified for demo: only handle real exponents > 0
                 if(exponent === 2) return base.mul(base); // Common case
                 const r = Math.pow(base.abs(), exponent);
                 const theta = Math.atan2(base.im, base.re);
                 return new Complex(r * Math.cos(exponent * theta), r * Math.sin(exponent * theta));
             }
         }
         // Complex exponent - requires more advanced math (logs)
         throw new Error("Complex exponents not implemented in this basic version.");
    }

    static abs(c) {
        if (typeof c === 'number') return Math.abs(c);
        return c.abs();
    }

    // Helper for the formula
    static I() {
        return new Complex(0, 1);
    }
}