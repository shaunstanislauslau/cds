import {AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnInit, Output, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {cloneDeep} from 'lodash';
import {Subscription} from 'rxjs';
import {finalize} from 'rxjs/operators';
import {PipelineStatus} from '../../../model/pipeline.model';
import {Project} from '../../../model/project.model';
import {Workflow, WorkflowNodeJoin} from '../../../model/workflow.model';
import {WorkflowNodeRunManual, WorkflowRun, WorkflowRunRequest} from '../../../model/workflow.run.model';
import {WorkflowRunService} from '../../../service/workflow/run/workflow.run.service';
import {WorkflowCoreService} from '../../../service/workflow/workflow.core.service';
import {AutoUnsubscribe} from '../../decorator/autoUnsubscribe';
import {WorkflowDeleteJoinComponent} from './delete/workflow.join.delete.component';
import {WorkflowTriggerJoinComponent} from './trigger/trigger.join.component';

@Component({
    selector: 'app-workflow-join',
    templateUrl: './workflow.join.html',
    styleUrls: ['./workflow.join.scss']
})
@AutoUnsubscribe()
export class WorkflowJoinComponent implements AfterViewInit, OnInit {

    @Input() project: Project;
    @Input() workflow: Workflow;
    @Input() join: WorkflowNodeJoin;
    @Input() readonly = false;
    @Output() selectEvent = new EventEmitter<WorkflowNodeJoin>();

    disabled = false;
    loading = false;
    loadingRun = false;

    @ViewChild('workflowDeleteJoin')
    workflowDeleteJoin: WorkflowDeleteJoinComponent;
    @ViewChild('workflowJoinTrigger')
    workflowJoinTrigger: WorkflowTriggerJoinComponent;

    pipelineStatusEnum = PipelineStatus;

    zone: NgZone;
    options: {};

    workflowCoreSub: Subscription;
    currentWorkflowRun: WorkflowRun;
    selectedJoinId: number;

    constructor(private elementRef: ElementRef, private _workflowRunService: WorkflowRunService,
        private _workflowCoreService: WorkflowCoreService, private _router: Router, private _route: ActivatedRoute) {
        this.zone = new NgZone({enableLongStackTrace: false});
        this.options = {
            'fullTextSearch': true,
            onHide: () => {
                this.zone.run(() => {
                    this.elementRef.nativeElement.style.zIndex = 0;
                });
            }
        };

        this._route.queryParams.subscribe((qp) => {
            if (qp['selectedJoinId']) {
                this.selectedJoinId = parseInt(qp['selectedJoinId'], 10);
            } else {
                this.selectedJoinId = null;
            }
        });
    }

    ngAfterViewInit() {
        this.elementRef.nativeElement.style.position = 'fixed';
        this.elementRef.nativeElement.style.top = 0;
    }

    ngOnInit() {
        this.workflowCoreSub = this._workflowCoreService.getCurrentWorkflowRun().subscribe(wr => {
            this.currentWorkflowRun = wr;
        });
    }

    selectJoinToLink(): void {
        this.selectEvent.emit(this.join);
    }

    selectJoin(): void {
        let qps = cloneDeep(this._route.snapshot.queryParams);
        qps['selectedNodeId'] = null;
        this._router.navigate([
            '/project', this.project.key,
            'workflow', this.workflow.name
        ], { queryParams: Object.assign({}, qps, {selectedJoinId: this.join.id })});
    }



    canBeLaunched() {
        if (!this.currentWorkflowRun || !this.currentWorkflowRun.nodes) {
            return false;
        }
        let lengthParentRun = 0;
        Object.keys(this.currentWorkflowRun.nodes).forEach((key) => {
            if (this.currentWorkflowRun.nodes[key].length &&
              this.join.source_node_id.includes(this.currentWorkflowRun.nodes[key][0].workflow_node_id)) {
                lengthParentRun++;
            }
        });

        return this.join.source_node_id.length === lengthParentRun;
    }

    playJoin(): void {
        let request = new WorkflowRunRequest();
        if (!this.join || !Array.isArray(this.join.triggers)) {
            return;
        }
        this.loading = true;
        this.loadingRun = true;

        request.manual = new WorkflowNodeRunManual();
        request.from_nodes = this.join.triggers.map((trig) => trig.workflow_dest_node_id);
        request.number = this.currentWorkflowRun.num;

        this._workflowRunService.runWorkflow(this.project.key, this.workflow.name, request)
            .pipe(finalize(() => {
                this.loading = false;
                this.loadingRun = false;
            }))
            .subscribe((wr) => {
                this._workflowCoreService.setCurrentWorkflowRun(wr);
                this._router.navigate(['/project', this.project.key, 'workflow', this.workflow.name, 'run', wr.num],
                {queryParams: { subnum: wr.last_subnumber }});
            });
    }
}
