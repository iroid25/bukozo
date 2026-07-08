"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingDown, TrendingUp, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { 
  calculateFlatRate, 
  calculateReducingBalance, 
  compareInterestMethods,
  formatUGX,
  type LoanCalculationInput 
} from "@/lib/interestCalculations";

export default function InterestCalculatorComponent() {
  const [principal, setPrincipal] = useState(1000000);
  const [interestRate, setInterestRate] = useState(2.5);
  const [periodMonths, setPeriodMonths] = useState(10);

  const input: LoanCalculationInput = {
    principal,
    interestRatePerMonth: interestRate,
    periodMonths,
  };

  const comparison = compareInterestMethods(input);
  const { flatRate, reducingBalance, interestSavings, savingsPercentage } = comparison;

  return (
    <div className="space-y-6">
      {/* Calculator Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Interest Calculation Comparison Tool
          </CardTitle>
          <CardDescription>
            Compare Flat Rate vs Reducing Balance methods with detailed amortization schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="calc-principal">Loan Principal (UGX)</Label>
              <Input
                id="calc-principal"
                type="number"
                step="100000"
                value={principal}
                onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-rate">Interest Rate (% per month)</Label>
              <Input
                id="calc-rate"
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-period">Loan Period (months)</Label>
              <Input
                id="calc-period"
                type="number"
                step="1"
                min="1"
                value={periodMonths}
                onChange={(e) => setPeriodMonths(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Comparison */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Flat Rate Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Interest:</span>
                <span className="font-semibold text-red-600">{formatUGX(flatRate.totalInterest)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Repayment:</span>
                <span className="font-semibold">{formatUGX(flatRate.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Monthly Payment:</span>
                <span className="font-medium">{formatUGX(flatRate.averageMonthlyPayment)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reducing Balance Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Interest:</span>
                <span className="font-semibold text-green-600">{formatUGX(reducingBalance.totalInterest)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Repayment:</span>
                <span className="font-semibold">{formatUGX(reducingBalance.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avg Monthly Payment:</span>
                <span className="font-medium">{formatUGX(reducingBalance.averageMonthlyPayment)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              Interest Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-600">
                {formatUGX(interestSavings)}
              </div>
              <div className="text-sm text-muted-foreground">
                {savingsPercentage.toFixed(1)}% less interest with Reducing Balance
              </div>
              <Badge variant="outline" className="bg-white">
                Borrower saves {formatUGX(interestSavings)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Schedules</CardTitle>
          <CardDescription>Month-by-month breakdown of principal and interest payments</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="flat" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="flat">Flat Rate Schedule</TabsTrigger>
              <TabsTrigger value="reducing">Reducing Balance Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="flat" className="mt-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Month</TableHead>
                      <TableHead className="text-right">Principal Payment</TableHead>
                      <TableHead className="text-right">Interest Payment</TableHead>
                      <TableHead className="text-right">Total Payment</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flatRate.monthlyPayments.map((payment) => (
                      <TableRow key={payment.month}>
                        <TableCell className="font-medium">{payment.month}</TableCell>
                        <TableCell className="text-right">{formatUGX(payment.principalPayment)}</TableCell>
                        <TableCell className="text-right">{formatUGX(payment.interestPayment)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatUGX(payment.totalPayment)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatUGX(payment.balanceAfterPayment)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{formatUGX(flatRate.totalPrincipal)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatUGX(flatRate.totalInterest)}</TableCell>
                      <TableCell className="text-right">{formatUGX(flatRate.totalAmount)}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="reducing" className="mt-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Month</TableHead>
                      <TableHead className="text-right">Remaining Principal</TableHead>
                      <TableHead className="text-right">Principal Payment</TableHead>
                      <TableHead className="text-right">Interest Payment</TableHead>
                      <TableHead className="text-right">Total Payment</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reducingBalance.monthlyPayments.map((payment) => (
                      <TableRow key={payment.month}>
                        <TableCell className="font-medium">{payment.month}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatUGX(payment.remainingPrincipal)}
                        </TableCell>
                        <TableCell className="text-right">{formatUGX(payment.principalPayment)}</TableCell>
                        <TableCell className="text-right">{formatUGX(payment.interestPayment)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatUGX(payment.totalPayment)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatUGX(payment.balanceAfterPayment)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">{formatUGX(reducingBalance.totalPrincipal)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatUGX(reducingBalance.totalInterest)}</TableCell>
                      <TableCell className="text-right">{formatUGX(reducingBalance.totalAmount)}</TableCell>
                      <TableCell className="text-right">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Formulas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Calculation Formulas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Flat Rate Method</h4>
            <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
              <div>Interest per Month = (Interest Rate / 100) × Principal</div>
              <div>Total Interest = Interest per Month × Period</div>
              <div>Monthly Installment = (Principal + Total Interest) / Period</div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Reducing Balance Method</h4>
            <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
              <div>For each month:</div>
              <div className="ml-4">Interest Payment = (Interest Rate / 100) × Remaining Principal</div>
              <div className="ml-4">Principal Payment = Remaining Principal / Remaining Months</div>
              <div className="ml-4">Total Payment = Principal Payment + Interest Payment</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong className="text-green-900">Use Reducing Balance Method for:</strong>
              <ul className="mt-2 ml-4 space-y-1 text-sm text-green-800">
                <li>• Member loans (more fair to borrowers)</li>
                <li>• Long-term loans (12+ months)</li>
                <li>• When competing with other financial institutions</li>
                <li>• To encourage early repayment</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <strong className="text-orange-900">Use Flat Rate Method for:</strong>
              <ul className="mt-2 ml-4 space-y-1 text-sm text-orange-800">
                <li>• Short-term emergency loans (3-6 months)</li>
                <li>• When administrative simplicity is priority</li>
                <li>• When predictable payments are important</li>
                <li>• Internal SACCO operations need higher interest income</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
