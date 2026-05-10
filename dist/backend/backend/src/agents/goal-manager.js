"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalManager = void 0;
class GoalManager {
    mainGoal = null;
    setMainGoal(description) {
        this.mainGoal = {
            id: 'main',
            description,
            status: 'active',
            subgoals: []
        };
    }
    updateSubgoals(descriptions) {
        if (!this.mainGoal)
            return;
        this.mainGoal.subgoals = descriptions.map((desc, index) => ({
            id: `sub-${index}`,
            description: desc,
            status: 'pending'
        }));
    }
    completeSubgoal(id) {
        if (!this.mainGoal || !this.mainGoal.subgoals)
            return;
        const subgoal = this.mainGoal.subgoals.find(s => s.id === id);
        if (subgoal)
            subgoal.status = 'completed';
    }
    getGoalContext() {
        if (!this.mainGoal)
            return 'No active goal.';
        let context = `Main Goal: ${this.mainGoal.description}\n`;
        if (this.mainGoal.subgoals && this.mainGoal.subgoals.length > 0) {
            context += "Plan:\n";
            this.mainGoal.subgoals.forEach(s => {
                context += `- [${s.status === 'completed' ? 'X' : ' '}] ${s.description}\n`;
            });
        }
        return context;
    }
}
exports.GoalManager = GoalManager;
