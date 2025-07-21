import "./actions.css";
import ActionAddEventsByKeyword from "../components/FR/action.addEventsByKeyword";
import ActionStartSalesFromOneVenue from "../components/FR/action.startSalesFromOneVenue";
const Actions = () => {

    return (
        <div className="actions-main">
            <div className="title-page">Actions</div>
            <ActionAddEventsByKeyword />
            <ActionStartSalesFromOneVenue />
        </div>
    );
};

export default Actions;