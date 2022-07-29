var clear;

(function makeAndSendExecutor(eval) {
    window.sendExecutor(executorForThisScope(eval));

    function executorForThisScope(eval) {
        //global eval is stored in this closure, in case the global variable 'eval' is changed
        return execute;

        function execute(statement) {
            return eval(statement);
        }
    }

})(eval);