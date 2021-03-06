/**
 * bpm 提交流程按钮
 */
import axios from 'axios';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Button, Modal ,Table,Row,Label,Checkbox,Form } from 'tinper-bee';
import { RefMultipleTableWithInput } from 'ref-multiple-table'

// import Table from 'bee-table';

import { onCommit, queryBpmTemplateAllocate, reconvert } from './common';

// import 'ref-multiple-table/lib/index.css';


const propTypes = {
    checkedArray: PropTypes.array,
    funccode: PropTypes.string,
    nodekey: PropTypes.string,
    url: PropTypes.string,
    urlAssignSubmit: PropTypes.string,
    className: PropTypes.string,
    filterRefUrl: PropTypes.string,
    refCode: PropTypes.string,
    size: PropTypes.string,
    scrollY: PropTypes.number,
    isOne: PropTypes.bool,
    onSuccess: PropTypes.func,
    onError: PropTypes.func,
    onStart: PropTypes.func,
    onEnd: PropTypes.func
};

class BpmButtonSubmit extends Component {
    constructor() {
        super();
        this.state = {
            childRefKey: [],//参照组件选择的数据
            userIds: [],
            processDefineCode: "",
            assignInfo: {
                assignInfoItems: []
            },
            obj: [],//单据数据
            huanjieShow: false,//环节指派显示
            huanjieList: [],
            chaosongShow:false,//抄送显示
            editRowIndex: 0,
            showVal: [],
            checkedArray:[], //指派选择的数据
            copyusers:[],   //抄送数据
            intersection:true,  //是否交集
            submiting:false
        }
    }
    //提交流程按钮
    handlerBtn = async () => {
        let { checkedArray, isOne, onStart, onEnd, onSuccess, onError } = this.props;
        //检查是否多单据提交
        if (isOne && checkedArray.length >= 2) {
            onError && onError({
                type: 2,
                msg: `请选择单条数据提交`
            });
            return;
        }

        //处理数据提交第一次请求，然后发起二次请求
        if (checkedArray.length > 0) {
            //如果传来的数据状态bpmState==null or 0 那么直接给出错误重复提交
            if (checkedArray[0].bpmState >= 1) {
                onError && onError({
                    type: 1,
                    msg: `不能提交此单据，重复提交`
                });
                return;
            }
            //加载事件
            onStart && onStart();
            //提交第一次请求，获得res_code通过funccode,nodekey
            let { data: { success, detailMsg } } = await queryBpmTemplateAllocate({
                funccode: this.props.funccode,
                nodekey: this.props.nodekey
            });
            if(!detailMsg.data ||detailMsg.data==null){
                onError && onError({
                    type: 1,
                    msg: `当前单据没有绑定流程`
                });
                return;
            }
            //正常拿到成功数据后
            if (success == "success") {
                //组织新的第二次提交参数，用于是否有流程指派操作等
                let commitParam = {
                    "url": this.props.url,
                    "processDefineCode": detailMsg.data.res_code,
                    "submitArray": checkedArray
                }
                //得到下次需要接口用的res_code
                this.setState({
                    processDefineCode: detailMsg.data.res_code
                });
                //收集参数准备提交submit
                let result = await onCommit(commitParam);
                let flag = result.data.success;
                //一般普通的提交成功和失败
                if (flag == "success" && (!result.data.detailMsg.data.assignAble)) {
                    //正确
                    onSuccess && onSuccess();
                } else if (flag == "fail_global") {
                    //后端错误
                    onError && onError({
                        type: 2,
                        msg: reconvert(result.data.message) || '流程启动失败'
                    });
                }
                //当得知需要二次弹出环节面板
                if (result.data.detailMsg.data && result.data.detailMsg.data.assignAble == true) {
                    //判断是否有最新的活动id和name
                    if (result.data.detailMsg.data.assignedActivities && result.data.detailMsg.data.assignedActivities.length > 0) {
                        //停止事件
                        onEnd && onEnd();
                        let arr = result.data.detailMsg.data.assignedActivities.filter( (item)=>{ return !item.properties.startactivity;});
                        //更新环节指派数据
                        this.setState({
                            huanjieShow: true,
                            chaosongShow:result.data.detailMsg.data.assignedActivities[0].properties.iscopytouser,
                            huanjieList: arr,
                            obj: checkedArray,
                            assignInfo: {
                                assignInfoItems: Array.from(arr, x => ({ activityId: x.id, activityName: x.name, participants: [] }))
                            }
                        });
                    }
                }
            } else if (success == "fail_global") {
                let { data: { message } } = result
                //流程提交错误
                onError && onError({
                    type: 2,
                    msg: reconvert(message) || '流程启动失败'
                });
            }
        } else {
            // 弹出提示
            onError && onError({
                type: 1,
                msg: `请选择提交的单据`
            });
        }

    }
    //通用关闭方法
    closeHuanjie = () => {
        this.setState({
            huanjieShow: false,
            chaosongShow:false,
            childRefKey: [],
            showVal: []
        });
    }
    //选择用户后的确定事件
    signAddOK = () => {
        //修改第几个数据
        let _index = this.state.editRowIndex;
        //副本原始对象
        let sourseArray = this.state.assignInfo.assignInfoItems.slice();
        //根据修改索引修改指定数据内容
        sourseArray[_index]['participants'] = Array.from(this.state.userIds, x => ({ id: x.id }));
        this.setState({
            assignInfo: {
                assignInfoItems: sourseArray
            },
            userIds: []
        });
    }
    //选择完所有加签后的确定事件
    huanjieHandlerOK = async () => {
        let { urlAssignSubmit, onSuccess, onError, onStart, onEnd } = this.props;
        let { processDefineCode, assignInfo, obj,copyusers,intersection,submiting } = this.state;
        obj=obj[0];
        let arr=[];
        let self = this;
        copyusers.map(function(value) {
            arr=arr.concat(value);
        });
        copyusers=arr;
        //加载事件
        if(!submiting){
            onStart && onStart();
            this.setState({
                submiting:true
            })
            let result = await axios.post(urlAssignSubmit, {
                processDefineCode,
                assignInfo,
                obj,
                copyusers,
                intersection

            }).catch((e) => {

                onError && onError({
                    type: 2,
                    msg: `后台服务请求发生错误`
                });
                self.setState({
                    submiting:false
                })
            });
            if (result.data.success == 'success') {
                onSuccess && onSuccess();
                this.setState({
                    huanjieShow: false,
                    chaosongShow:false,
                    childRefKey: [],
                    showVal: [],
                    submiting:false
                });
            } else if (result.data.success == 'fail_global') {
                onError && onError({
                    type: 2,
                    msg: reconvert(result.data.message) || '流程启动失败'
                });
                this.setState({
                    huanjieShow: false,
                    chaosongShow:false,
                    childRefKey: [],
                    showVal: [],
                    submiting:false
                });
            }
        }
    }
    changeCheck=()=> {
        this.setState({intersection:!this.state.intersection});
    }


    onSave=(data,xxx)=>{
        console.log("xxxx",data,xxx)
    }


    render() {
        let self = this;

        console.log("huanjieList",this.state.huanjieList);


        let huanjieCol = [{
            title: "名称",
            dataIndex: "name",
            key: "name",

        },
            {
                title: "指派",
                dataIndex: "1",
                key: "1",
                render(text, record, index) {


                    console.log("text, record, index",text, record, index)
                    const self=this;

                    const {participants}=record;

                    console.log("text, record, index",participants,text, record, index)

                    let props = {
                        placeholder: "请选择指派人",
                        title: '请选择指派人',
                        multiple: true,
                        strictMode: true,
                        miniSearch: false,
                        valueField: "code",
                        displayField: "{name}",
                        tableData:participants,
                        // tableData:[{ "rownum_": 1, "code": "001", "name": "人员1", "mobile": "15011430230", "refcode": "001", "refpk": "cc791b77-bd18-49ab-b3ec-ee83cd40012a", "id": "cc791b77-bd18-49ab-b3ec-ee83cd40012a", "refname": "人员1", "email": "11@11.com", "key": "cc791b77-bd18-49ab-b3ec-ee83cd40012a" },],
                        columnsData: [{ "key": "code", "dataIndex": "code", "title": "人员编码" }, { "key": "name", "dataIndex": "name", "title": "人员名称" }],
                        fliterFormInputs: [],
                        showLoading:false,
                        // filterUrl: '/pap_basedoc/common-ref/filterRefJSON',
                        // matchData: [{"_checked":true,"rownum_":2,"code":"002","name":"人员2","mobile":"15011323234","refcode":"002","refpk":"de2d4d09-51ec-4108-8def-d6a6c5393c3b","id":"de2d4d09-51ec-4108-8def-d6a6c5393c3b","refname":"人员2","email":"22@11.com","key":"de2d4d09-51ec-4108-8def-d6a6c5393c3b"}],

                    }

                    return (
                        <RefMultipleTableWithInput
                            {...props}
                            // onCancel={this.onCancel}
                        >
                        </RefMultipleTableWithInput>
                    )
                }
            }]


        return (<span>
            <span onClick={this.handlerBtn}>
                {
                    this.props.children
                }
            </span>
            <Modal
                size={this.props.size}
                show={this.state.huanjieShow||this.state.chaosongShow}
                backdrop={false}
                enforceFocus={false}
                onHide={this.closeHuanjie}>
                <Modal.Header closeButton>
                    <Modal.Title> {this.state.huanjieShow?'环节指派':'抄送'}</Modal.Title>
                </Modal.Header>
                {this.state.huanjieShow?<Modal.Body>
                    <Table
                        rowKey={record => record.id}
                        columns={huanjieCol}
                        data={this.state.huanjieList}
                        scroll={{ x: "100%", y: 200 }}
                    />
                </Modal.Body>:""}

                <Modal.Footer>
                    <Button style={{ "marginRight": "10px" }}  onClick={this.closeHuanjie}> 关闭 </Button>
                    <Button colors="primary"  onClick={this.huanjieHandlerOK}> 确定 </Button>

                </Modal.Footer>
            </Modal>
        </span>);
    }
}
BpmButtonSubmit.propTypes = propTypes;
BpmButtonSubmit.defaultProps = {
    checkedArray: [],
    nodekey: "003",
    funccode: "react",
    url: "/example/ygdemo_yw_info/submit",
    urlAssignSubmit: "/example/ygdemo_yw_info/assignSubmit",
    className: "",
    filterRefUrl: "/iuap_pap_quickstart/common/filterRef",
    refCode: "relatedUser",
    size: "",
    scrollY: 270,
    isOne: false,
    organrefCode:"newdept",
    positonrefCode:"newposition",
    roleRef:"newRoleRef",
    userRef:"relatedUser"
}
export default BpmButtonSubmit;
